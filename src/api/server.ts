import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
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
    // SSE placeholder — implementacao mais elaborada exigiria broker.
    // Aqui documentamos o contrato para o consumidor (CLI/UI).
    reply
      .code(501)
      .send({ error: "streaming sera implementado com um broker (Redis/NATS)" });
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

  return app;
}

const app = await buildServer();
app.listen({ port: env.PORT, host: env.HOST }).then(() => {
  logger.info({ port: env.PORT, host: env.HOST }, "krato-ai api online");
});
