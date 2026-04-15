import { env } from "../config/env.js";
import { router } from "../llm/router.js";
import type { ChatMessage, GenerateOptions } from "../llm/types.js";
import { logger } from "../utils/logger.js";
import type { Blackboard } from "../orchestrator/blackboard.js";
import { globalMemory } from "../memory/global.js";

export type AgentRole = "product" | "design" | "developer" | "qa" | "devsecops" | "router";

export interface AgentContext {
  sessionId: string;
  actorId: string;
  projectId: string;
  goal: string;
  blackboard: Blackboard;
}

export interface AgentConfig {
  role: AgentRole;
  title: string;
  /** Modelo preferido desta funcao. Pode ser sobrescrito pelo router. */
  preferredModel?: string;
  /** Temperatura padrao para este perfil cognitivo. */
  temperature?: number;
  /** System prompt base (sem o preambulo da memoria global). */
  systemPrompt: string;
}

export abstract class Agent {
  constructor(public config: AgentConfig) {}

  protected get logger() {
    return logger.child({ agent: this.config.role });
  }

  /**
   * Gera uma resposta usando o LLM apropriado, enriquecendo com:
   *  - preambulo global (Identidade Cognitiva)
   *  - dicas de roteamento (complexidade, multimodal, proposito)
   */
  protected async generate(
    ctx: AgentContext,
    messages: ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<string> {
    const preamble = globalMemory.buildPreamble(ctx.actorId);
    const system: ChatMessage = {
      role: "system",
      content: preamble
        ? `${preamble}\n\n---\n\n${this.config.systemPrompt}`
        : this.config.systemPrompt,
    };
    const { text, model, route, latencyMs } = await router.generate(
      [system, ...messages],
      {
        model: options.model ?? this.config.preferredModel,
        temperature: options.temperature ?? this.config.temperature ?? 0.2,
        ...options,
        hints: { purpose: this.purposeHint(), ...(options.hints ?? {}) },
      },
    );
    this.logger.info(
      { model, route, latencyMs, role: this.config.role },
      "agent.generate",
    );
    globalMemory.logEvent(ctx.sessionId, this.config.role, "generate", {
      model,
      route,
      latencyMs,
    });
    return text;
  }

  private purposeHint(): NonNullable<GenerateOptions["hints"]>["purpose"] {
    switch (this.config.role) {
      case "developer":
        return "code";
      case "qa":
        return "eval";
      case "design":
        return "design";
      case "product":
        return "plan";
      default:
        return "route";
    }
  }

  /** Metodo principal que cada agente especializa. */
  abstract run(ctx: AgentContext, input: string): Promise<AgentResult>;

  /** Publica no blackboard e retorna o artefato. */
  protected publish<T>(ctx: AgentContext, artifact: Artifact<T>): Artifact<T> {
    ctx.blackboard.publish(artifact);
    globalMemory.logEvent(ctx.sessionId, this.config.role, "publish", {
      kind: artifact.kind,
    });
    return artifact;
  }
}

export interface Artifact<T = unknown> {
  kind: string;
  author: AgentRole;
  data: T;
  createdAt: string;
}

export interface AgentResult {
  summary: string;
  artifacts: Artifact[];
  /** Agente que deve ser invocado a seguir (handoff). */
  nextAgent?: AgentRole | "done";
}

/** Util: extrai o primeiro bloco JSON de uma resposta do LLM. */
export function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/** Util: extrai blocos ```lang\n...\n``` de uma resposta. */
export function extractCodeBlocks(text: string): Array<{ lang: string; code: string }> {
  const blocks: Array<{ lang: string; code: string }> = [];
  const re = /```([\w-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    blocks.push({ lang: m[1] || "txt", code: m[2] || "" });
  }
  return blocks;
}

export { env };
