import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import staticFiles from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { mcp } from "../execution/mcp-client.js";
import { cloud } from "../llm/cloud.js";
import { ollama } from "../llm/ollama.js";
import { globalMemory, type GlobalFact } from "../memory/global.js";
import { qdrant } from "../memory/vector.js";
import { orchestrator, type OrchestratorEvent } from "../orchestrator/graph.js";
import { logger } from "../utils/logger.js";
import { personalAgent } from "../agents/personal.js";
import { startTelegramBot } from "../telegram/bot.js";
import { eventBus } from "./event-bus.js";

const runSchema = z.object({
  actorId: z.string().min(1),
  goal: z.string().min(1),
  projectId: z.string().optional(),
  initialInput: z.string().optional(),
  images: z
    .array(z.object({ data: z.string(), mime: z.string().optional() }))
    .optional(),
  maxIterations: z.number().int().min(1).max(20).optional(),
});

const factSchema = z.object({
  actorId: z.string().min(1),
  kind: z.enum(["preference", "pattern", "rule", "lesson"]),
  text: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.8),
});

export async function buildServer() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(staticFiles, {
    root: "/workspace/src/ui",
    prefix: "/ui/",
  });

  app.get("/health", async () => {
    const [ol, q, mc] = await Promise.all([
      ollama.ping().then((r) => r.ok).catch(() => false),
      qdrant.ping().catch(() => false),
      mcp.configured ? mcp.ping().catch(() => false) : Promise.resolve(null),
    ]);
    return {
      ok: true,
      ollama: ol,
      qdrant: q,
      mcp: mc,
      cloud: cloud.enabled,
    };
  });

  app.get("/models", async () => {
    const list = await ollama.ping();
    return {
      available: list.models,
      defaults: {
        router: env.KRATO_MODEL_ROUTER,
        coder: env.KRATO_MODEL_CODER,
        eval: env.KRATO_MODEL_EVAL,
        embed: env.KRATO_MODEL_EMBED,
        cloud: env.CLOUD_MODEL,
      },
    };
  });

  app.post("/runs", async (req, reply) => {
    const input = runSchema.parse(req.body);

    const events: OrchestratorEvent[] = [];
    const result = await orchestrator.run({
      ...input,
      onEvent: (e) => {
        events.push(e);
        logger.info(e, "orchestrator event");
      },
    });

    reply.send({
      sessionId: result.sessionId,
      projectId: result.projectId,
      status: result.status,
      summary: result.summary,
      events,
      artifacts: result.blackboard.all(),
    });
  });

  app.get("/runs/:sessionId/stream", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    
    // Configura headers para SSE
    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");
    reply.header("X-Accel-Buffering", "no");

    // Envia evento inicial de conexao
    reply.send(`data: ${JSON.stringify({ type: "connected", sessionId, timestamp: new Date().toISOString() })}\n\n`);

    // Inscreve cliente no event bus
    const unsubscribe = eventBus.subscribe(
      sessionId,
      (event) => {
        try {
          reply.send(`data: ${JSON.stringify(event)}\n\n`);
        } catch (err) {
          logger.warn({ sessionId, error: err }, "client disconnected");
          unsubscribe();
        }
      },
      () => {
        logger.info({ sessionId }, "client unsubscribed from stream");
      }
    );

    // Limpa inscricao quando cliente desconecta
    reply.raw.on("close", () => {
      unsubscribe();
      logger.info({ sessionId }, "SSE connection closed");
    });

    // Timeout apos 5 minutos sem atividade
    const timeout = setTimeout(() => {
      reply.send(`data: ${JSON.stringify({ type: "timeout", sessionId, timestamp: new Date().toISOString() })}\n\n`);
      unsubscribe();
    }, 5 * 60 * 1000);

    reply.raw.on("close", () => clearTimeout(timeout));
  });

  // ---- Memoria global ----
  app.get("/memory/global", async (req) => {
    const { actorId } = z
      .object({ actorId: z.string() })
      .parse(req.query as unknown);
    return { facts: globalMemory.listFacts(actorId) };
  });

  app.post("/memory/global", async (req) => {
    const fact = factSchema.parse(req.body);
    const created = globalMemory.addFact(fact);
    return created satisfies GlobalFact;
  });

  // ---- Agente Pessoal (API) ----
  app.post("/personal/run", async (req) => {
    const { actorId, input } = z.object({
      actorId: z.string().min(1),
      input: z.string().min(1),
    }).parse(req.body);

    const result = await personalAgent.run(
      {
        sessionId: `api-${Date.now()}`,
        actorId,
        projectId: "personal",
        goal: "assistir usuario em tarefas pessoais",
        blackboard: { publish: () => {}, all: () => [] } as any,
      },
      input
    );

    return result;
  });

  // ---- UI Dashboard ----
  app.get("/dashboard", async (req, reply) => {
    return reply.sendFile("dashboard.html");
  });

  // Servir dashboard como fallback para /ui/
  app.get("/ui/", async (req, reply) => {
    return reply.sendFile("dashboard.html");
  });

  // ---- Endpoint para buscar execuções ----
  app.get("/runs", async (req) => {
    // Em produção, buscaria do banco de dados
    // Retorna lista vazia por enquanto
    return { runs: [] };
  });

  return app;
}

const app = await buildServer();

// Inicia bot do Telegram se configurado
if (env.TELEGRAM_BOT_TOKEN) {
  startTelegramBot().catch((err) => {
    logger.error(err, "Failed to start Telegram bot");
  });
}

app.listen({ port: env.PORT, host: env.HOST }).then(() => {
  logger.info({ port: env.PORT, host: env.HOST }, "krato-ai api online");
});
