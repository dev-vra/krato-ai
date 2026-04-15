import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { router } from "../llm/router.js";
import type { ChatMessage } from "../llm/types.js";

/**
 * Memoria Global (Portfolio de Contexto Pessoal).
 *
 * Guarda fatos semanticos destilados apos cada sessao: preferencias do
 * engenheiro, padroes de codigo repetidamente corrigidos, regras
 * infra-estruturais recorrentes. Ao iniciar um novo projeto, esses fatos
 * sao injetados no system prompt, fazendo com que o time de agentes se
 * comporte de forma consistente mesmo em projetos completamente novos.
 *
 * Armazenamento: SQLite (cheap, robusto, backup trivial).
 */

export interface GlobalFact {
  id: string;
  actorId: string;
  kind: "preference" | "pattern" | "rule" | "lesson";
  text: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  hits: number;
}

export class GlobalMemory {
  private db: Database.Database;

  constructor(dbPath: string = env.KRATO_DB_PATH) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_facts (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        hits INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_global_actor ON global_facts(actor_id);
      CREATE INDEX IF NOT EXISTS idx_global_kind ON global_facts(kind);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    `);
  }

  // ---------- Fatos globais ----------
  listFacts(actorId: string, limit = 50): GlobalFact[] {
    const rows = this.db
      .prepare(
        `SELECT id, actor_id as actorId, kind, text, confidence, hits,
                created_at as createdAt, updated_at as updatedAt
         FROM global_facts
         WHERE actor_id = ?
         ORDER BY confidence DESC, hits DESC
         LIMIT ?`,
      )
      .all(actorId, limit) as GlobalFact[];
    return rows;
  }

  addFact(fact: Omit<GlobalFact, "id" | "createdAt" | "updatedAt" | "hits">): GlobalFact {
    const now = new Date().toISOString();
    const row: GlobalFact = {
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
      hits: 0,
      ...fact,
    };
    this.db
      .prepare(
        `INSERT INTO global_facts (id, actor_id, kind, text, confidence, hits, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.actorId,
        row.kind,
        row.text,
        row.confidence,
        row.hits,
        row.createdAt,
        row.updatedAt,
      );
    return row;
  }

  touchFact(id: string): void {
    this.db
      .prepare(
        `UPDATE global_facts SET hits = hits + 1, updated_at = ? WHERE id = ?`,
      )
      .run(new Date().toISOString(), id);
  }

  /** Destila a transcricao de uma sessao em fatos globais via LLM. */
  async distill(actorId: string, transcript: ChatMessage[]): Promise<GlobalFact[]> {
    const system: ChatMessage = {
      role: "system",
      content: `Voce e um observador silencioso de uma equipe de engenharia de software.
Dado o transcript de uma sessao de trabalho, extraia FATOS GENERALIZAVEIS sobre
o engenheiro humano (actorId=${actorId}) que deveriam persistir entre projetos.

Responda APENAS JSON no formato:
{"facts": [{"kind": "preference|pattern|rule|lesson", "text": "...", "confidence": 0..1}]}

Ignore fatos especificos deste projeto. Destile preferencias de estilo,
exigencias de infraestrutura, padroes recorrentes de critica, regras explicitas.
Nunca invente — so extraia o que esta evidente no transcript.`,
    };
    const joined = transcript
      .slice(-40)
      .map((m) => `[${m.role}] ${typeof m.content === "string" ? m.content : "(multimodal)"}`)
      .join("\n");

    try {
      const { text } = await router.generate([system, { role: "user", content: joined }], {
        format: "json",
        temperature: 0.1,
        hints: { purpose: "eval", complexity: "medium" },
      });
      const parsed = JSON.parse(text) as { facts: Array<Omit<GlobalFact, "id" | "createdAt" | "updatedAt" | "hits" | "actorId">> };
      const created: GlobalFact[] = [];
      for (const f of parsed.facts ?? []) {
        if (!f?.text) continue;
        created.push(this.addFact({ actorId, ...f }));
      }
      logger.info({ actorId, count: created.length }, "global: fatos destilados");
      return created;
    } catch (err) {
      logger.warn({ err }, "global.distill falhou (ignorando)");
      return [];
    }
  }

  /** Constroi o preambulo que sera injetado no system prompt de todos os agentes. */
  buildPreamble(actorId: string): string {
    const facts = this.listFacts(actorId, 30);
    if (!facts.length) return "";
    const grouped: Record<string, string[]> = {};
    for (const f of facts) {
      (grouped[f.kind] ??= []).push(f.text);
    }
    const lines: string[] = [
      "Identidade Cognitiva — fatos persistentes do engenheiro responsavel:",
    ];
    for (const [kind, items] of Object.entries(grouped)) {
      lines.push(`- ${kind}:`);
      for (const it of items.slice(0, 8)) lines.push(`    * ${it}`);
    }
    return lines.join("\n");
  }

  // ---------- Sessoes / eventos (blackboard persistido) ----------
  createSession(actorId: string, projectId: string, goal: string): string {
    const id = nanoid();
    this.db
      .prepare(
        `INSERT INTO sessions (id, actor_id, project_id, goal, status, started_at)
         VALUES (?, ?, ?, ?, 'running', ?)`,
      )
      .run(id, actorId, projectId, goal, new Date().toISOString());
    return id;
  }

  endSession(id: string, status: "completed" | "failed" | "cancelled"): void {
    this.db
      .prepare(`UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), id);
  }

  logEvent(sessionId: string, agent: string, kind: string, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO events (id, session_id, agent, kind, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        nanoid(),
        sessionId,
        agent,
        kind,
        JSON.stringify(payload),
        new Date().toISOString(),
      );
  }

  close(): void {
    this.db.close();
  }
}

export const globalMemory = new GlobalMemory();
