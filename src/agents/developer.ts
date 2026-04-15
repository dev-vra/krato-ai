import path from "node:path";
import { env } from "../config/env.js";
import { mcp } from "../execution/mcp-client.js";
import { ProjectRAG } from "../memory/rag.js";
import { Agent, extractCodeBlocks, extractJson, type AgentContext, type AgentResult } from "./base.js";
import type { PRD, ProductOutput } from "./product.js";
import type { DesignOutput, ScreenSpec } from "./design.js";

export interface FileChange {
  path: string;
  content: string;
  reason: string;
}

export interface DeveloperOutput {
  files: FileChange[];
  commands: string[]; // comandos a executar (ex: `pnpm install zod`)
  notes: string;
}

/**
 * Lead Full Stack Agent — o Construtor Logico.
 *
 * Transforma PRD + Design em codigo real, escrito via MCP na maquina local.
 * Pipeline:
 *   1) Se e o primeiro turno, roda `npx create-next-app@latest ...` para
 *      scaffold no workspace.
 *   2) Recupera chunks relevantes via RAG (memoria episodica).
 *   3) Pede ao LLM para emitir um JSON estruturado com {files, commands, notes}.
 *   4) Aplica o patch via MCP writeFile + executa comandos permitidos.
 *   5) Indexa os arquivos escritos no RAG para retroalimentar o contexto.
 */
export class DeveloperAgent extends Agent {
  constructor() {
    super({
      role: "developer",
      title: "Lead Full Stack Agent",
      preferredModel: env.KRATO_MODEL_CODER,
      temperature: 0.15,
      systemPrompt: `Voce e o Lead Full Stack Agent (TypeScript, React 19, Next.js 15).

Regras de engenharia (nao-negociaveis):
- TypeScript strict em todos os arquivos; nada de "any" implicito.
- Componentes organizados por feature (src/features/<dominio>), nao por tipo.
- Named exports apenas (nunca "export default").
- Single quotes, trailing comma sempre, imports ordenados.
- Acessibilidade: role/aria-label em tudo que for interativo.
- Estado global leve (Zustand). Estado assincrono via TanStack Query.
- Estilos com Tailwind usando os design tokens fornecidos.

Saida: SEMPRE JSON puro no formato:
  {
    "files": [{ "path": "caminho/relativo/ao/projeto", "content": "...", "reason": "..." }],
    "commands": ["npm install ..."],
    "notes": "breve explicacao do que foi feito"
  }
Nunca use blocos de codigo fora do JSON. Escreva arquivos completos (nao diffs).`,
    });
  }

  async run(ctx: AgentContext, input: string): Promise<AgentResult> {
    const bb = ctx.blackboard;
    const prd = bb.latest<PRD>("product.prd");
    const stack = bb.latest<ProductOutput["stackRecommendation"]>("product.stack");
    const tokens = bb.latest<DesignOutput["tokens"]>("design.tokens");
    const screens = bb.latest<ScreenSpec[]>("design.screens");

    const rag = new ProjectRAG(ctx.projectId);
    await rag.init();

    // Scaffold inicial, se necessario
    const scaffolded = bb.latest<boolean>("developer.scaffolded");
    if (!scaffolded) {
      await this.scaffoldProject(ctx);
      bb.publish({
        kind: "developer.scaffolded",
        author: "developer",
        data: true,
        createdAt: new Date().toISOString(),
      });
    }

    // Contexto RAG
    const retrieved = await rag.retrieve(
      `${prd?.vision ?? ""}\n${input}\n${screens?.map((s) => s.name).join(", ") ?? ""}`,
      6,
    );
    const ragContext = retrieved
      .map((c) => `// ${c.path}\n${c.text}`)
      .join("\n\n---\n\n");

    const criticism = bb.latest<string>("qa.feedback");

    const userPrompt = [
      `Projeto: ${ctx.projectId}`,
      `Objetivo: ${ctx.goal}`,
      prd ? `PRD:\n${JSON.stringify(prd, null, 2)}` : "",
      stack ? `Stack:\n${JSON.stringify(stack, null, 2)}` : "",
      tokens ? `Tokens:\n${JSON.stringify(tokens, null, 2)}` : "",
      screens ? `Telas:\n${JSON.stringify(screens, null, 2)}` : "",
      criticism ? `Feedback do QA a corrigir:\n${criticism}` : "",
      ragContext ? `Trechos relevantes do repo atual:\n${ragContext}` : "",
      `Pedido do usuario/supervisor:\n${input}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await this.generate(
      ctx,
      [{ role: "user", content: userPrompt }],
      { format: "json", hints: { purpose: "code", complexity: "high" } },
    );

    const parsed =
      extractJson<DeveloperOutput>(raw) ??
      this.fallbackFromCodeBlocks(raw);

    if (!parsed) {
      return {
        summary: "LLM nao devolveu patch valido.",
        artifacts: [],
        nextAgent: "done",
      };
    }

    // Aplica arquivos e indexa no RAG
    const applied: string[] = [];
    for (const f of parsed.files ?? []) {
      const rel = path.posix.join(ctx.projectId, f.path);
      try {
        await mcp.writeFile(rel, f.content);
        await rag.indexFile(f.path, f.content, path.extname(f.path).slice(1));
        applied.push(f.path);
      } catch (err) {
        this.logger.error({ err, path: f.path }, "falha ao escrever arquivo");
      }
    }

    // Executa comandos permitidos dentro da pasta do projeto
    const logs: Array<{ cmd: string; code: number; stderr: string }> = [];
    for (const cmd of parsed.commands ?? []) {
      try {
        const res = await mcp.exec(cmd, ctx.projectId);
        logs.push({ cmd, code: res.code, stderr: res.stderr });
      } catch (err) {
        logs.push({
          cmd,
          code: -1,
          stderr: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.publish(ctx, {
      kind: "developer.patch",
      author: "developer",
      data: { files: applied, commands: parsed.commands, logs, notes: parsed.notes },
      createdAt: new Date().toISOString(),
    });

    return {
      summary: `Aplicados ${applied.length} arquivos e ${parsed.commands?.length ?? 0} comandos.`,
      artifacts: [],
      nextAgent: "qa",
    };
  }

  private async scaffoldProject(ctx: AgentContext): Promise<void> {
    // Verifica se ja existe
    try {
      const entries = await mcp.listDir(ctx.projectId);
      if (entries.length) {
        this.logger.info({ projectId: ctx.projectId }, "pasta ja existe, pulando scaffold");
        return;
      }
    } catch {
      // pasta nao existe, seguimos
    }
    const cmd = `npx --yes create-next-app@latest ${ctx.projectId} --ts --tailwind --app --src-dir --eslint --use-npm --no-import-alias`;
    try {
      await mcp.exec(cmd);
      await mcp.exec("git init", ctx.projectId);
    } catch (err) {
      this.logger.warn({ err }, "scaffold automatico falhou (talvez pasta ja exista)");
    }
  }

  private fallbackFromCodeBlocks(raw: string): DeveloperOutput | null {
    const blocks = extractCodeBlocks(raw);
    if (!blocks.length) return null;
    // fallback simples: assume que cada bloco e um arquivo no topo nomeado como comentario
    const files: FileChange[] = [];
    for (const b of blocks) {
      const m = b.code.match(/^(?:\/\/|#)\s*([\w./-]+\.[\w]+)\s*\n([\s\S]*)$/);
      if (m) files.push({ path: m[1]!, content: m[2]!, reason: "fallback" });
    }
    return files.length ? { files, commands: [], notes: "fallback parse" } : null;
  }
}
