import { nanoid } from "nanoid";
import type { Agent, AgentContext, AgentResult, AgentRole } from "../agents/base.js";
import { DesignAgent } from "../agents/design.js";
import { DeveloperAgent } from "../agents/developer.js";
import { DevSecOpsAgent } from "../agents/devsecops.js";
import { ProductAgent } from "../agents/product.js";
import { QAAgent } from "../agents/qa.js";
import { globalMemory } from "../memory/global.js";
import { logger } from "../utils/logger.js";
import { Blackboard } from "./blackboard.js";
import { eventBus } from "../api/event-bus.js";

export interface RunOptions {
  actorId: string;
  projectId?: string;
  goal: string;
  initialInput?: string;
  images?: Array<{ data: string; mime?: string }>;
  /** Limite de iteracoes no loop Evaluator-Optimizer. */
  maxIterations?: number;
  /** Handler para HITL (recebe mensagens do orquestrador). */
  onEvent?: (event: OrchestratorEvent) => void;
}

export interface OrchestratorEvent {
  sessionId: string;
  agent: AgentRole;
  kind: "start" | "finish" | "handoff" | "error";
  summary?: string;
  next?: AgentRole | "done";
  error?: string;
}

export interface RunResult {
  sessionId: string;
  projectId: string;
  status: "completed" | "failed" | "max-iterations";
  blackboard: Blackboard;
  summary: string;
}

/**
 * Orquestrador em grafo de estados finitos (estilo LangGraph).
 *
 * Nos: product -> design -> developer -> qa -> devsecops
 *   - qa pode fazer handback para developer (loop Evaluator-Optimizer)
 *   - devsecops pode fazer handback para developer
 *   - maxIterations limita o loop total de desenvolvimento
 */
export class Orchestrator {
  private agents: Record<AgentRole, Agent>;

  constructor() {
    this.agents = {
      product: new ProductAgent(),
      design: new DesignAgent(),
      developer: new DeveloperAgent(),
      qa: new QAAgent(),
      devsecops: new DevSecOpsAgent(),
      router: new ProductAgent(), // placeholder — nao usado como no de fluxo
    };
  }

  async run(options: RunOptions): Promise<RunResult> {
    const projectId = options.projectId ?? `proj-${nanoid(8)}`;
    const sessionId = globalMemory.createSession(options.actorId, projectId, options.goal);
    const bb = new Blackboard();

    // Inputs iniciais no blackboard (imagens multimodais, etc.)
    if (options.images?.length) {
      bb.publish({
        kind: "input.images",
        author: "product",
        data: options.images,
        createdAt: new Date().toISOString(),
      });
    }

    const ctx: AgentContext = {
      sessionId,
      actorId: options.actorId,
      projectId,
      goal: options.goal,
      blackboard: bb,
    };

    let current: AgentRole | "done" = "product";
    let lastInput = options.initialInput ?? options.goal;
    const maxIter = options.maxIterations ?? 6;
    let iter = 0;

    try {
      while (current !== "done" && iter < maxIter) {
        iter++;
        const agent = this.agents[current];
        
        // Publica evento de inicio via event bus
        const startEvent = { sessionId, agent: current, kind: "start" as const };
        options.onEvent?.(startEvent);
        eventBus.publish({ ...startEvent, type: `agent_${current}_start`, timestamp: new Date().toISOString() });

        let result: AgentResult;
        try {
          result = await agent.run(ctx, lastInput);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err, agent: current }, "agent crashed");
          
          const errorEvent = { sessionId, agent: current, kind: "error" as const, error: message };
          options.onEvent?.(errorEvent);
          eventBus.publish({ ...errorEvent, type: `agent_${current}_error`, data: { message }, timestamp: new Date().toISOString() });
          
          globalMemory.logEvent(sessionId, current, "error", { message });
          globalMemory.endSession(sessionId, "failed");
          return {
            sessionId,
            projectId,
            status: "failed",
            blackboard: bb,
            summary: `Falha no agente ${current}: ${message}`,
          };
        }

        // Publica evento de conclusao do agente
        const finishEvent = {
          sessionId,
          agent: current,
          kind: "finish" as const,
          summary: result.summary,
          next: result.nextAgent,
        };
        options.onEvent?.(finishEvent);
        eventBus.publish({ ...finishEvent, type: `agent_${current}_finish`, data: { summary: result.summary, next: result.nextAgent }, timestamp: new Date().toISOString() });

        if (result.nextAgent && result.nextAgent !== "done") {
          const handoffEvent = {
            sessionId,
            agent: current,
            kind: "handoff" as const,
            next: result.nextAgent,
          };
          options.onEvent?.(handoffEvent);
          eventBus.publish({ ...handoffEvent, type: `handoff_${current}_to_${result.nextAgent}`, timestamp: new Date().toISOString() });
          
          current = result.nextAgent;
          lastInput = result.summary;
          continue;
        }
        current = "done";
      }

      // Destila aprendizado global ao final
      const transcript = bb.all().map((a) => ({
        role: "assistant" as const,
        content: `[${a.author}:${a.kind}] ${JSON.stringify(a.data).slice(0, 800)}`,
      }));
      await globalMemory.distill(options.actorId, transcript);

      const status = iter >= maxIter && current !== "done" ? "max-iterations" : "completed";
      const finalSummary = status === "completed"
        ? `Projeto ${projectId} concluido com sucesso apos ${iter} passos.`
        : `Pipeline atingiu ${maxIter} iteracoes sem convergencia.`;
      
      // Publica evento final
      eventBus.publish({
        sessionId,
        type: "run_completed",
        timestamp: new Date().toISOString(),
        data: { status, iterations: iter, summary: finalSummary }
      });
      
      globalMemory.endSession(sessionId, status === "max-iterations" ? "failed" : "completed");

      return {
        sessionId,
        projectId,
        status,
        blackboard: bb,
        summary: finalSummary,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      globalMemory.endSession(sessionId, "failed");
      return {
        sessionId,
        projectId,
        status: "failed",
        blackboard: bb,
        summary: `Erro fatal: ${message}`,
      };
    }
  }
}

export const orchestrator = new Orchestrator();
