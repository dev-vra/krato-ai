#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs/promises";
import { env } from "./config/env.js";
import { mcp } from "./execution/mcp-client.js";
import { cloud } from "./llm/cloud.js";
import { ollama } from "./llm/ollama.js";
import { globalMemory } from "./memory/global.js";
import { qdrant } from "./memory/vector.js";
import { orchestrator } from "./orchestrator/graph.js";

const program = new Command();
program
  .name("krato")
  .description("Krato-AI — rede multi-agente para criacao de sistemas full-stack")
  .version("0.1.0");

program
  .command("health")
  .description("Verifica conectividade com Ollama, Qdrant, MCP e nuvem")
  .action(async () => {
    const [ol, q, mc] = await Promise.all([
      ollama.ping(),
      qdrant.ping().catch(() => false),
      mcp.configured ? mcp.ping().catch(() => false) : Promise.resolve(null),
    ]);
    console.log(
      JSON.stringify(
        {
          ollama: ol,
          qdrant: q,
          mcp: mc,
          cloud: { enabled: cloud.enabled, provider: env.CLOUD_PROVIDER, model: env.CLOUD_MODEL },
        },
        null,
        2,
      ),
    );
    process.exit(0);
  });

program
  .command("run")
  .description("Executa um pipeline completo (product -> design -> dev -> qa -> devsecops)")
  .requiredOption("--actor <id>", "ID do humano responsavel (persiste aprendizado)")
  .requiredOption("--goal <descricao>", "Objetivo alto-nivel do projeto")
  .option("--project <id>", "ID do projeto (gera um novo se ausente)")
  .option("--input <texto>", "Input inicial para o Product Agent")
  .option("--image <caminho>", "Wireframe/mockup a anexar (pode repetir)", collect, [])
  .option("--max-iter <n>", "Maximo de passos no grafo", (v) => parseInt(v, 10), 8)
  .action(async (opts) => {
    const images = await Promise.all(
      (opts.image as string[]).map(async (p) => ({
        data: (await fs.readFile(p)).toString("base64"),
        mime: p.endsWith(".png") ? "image/png" : "image/jpeg",
      })),
    );

    const result = await orchestrator.run({
      actorId: opts.actor,
      goal: opts.goal,
      projectId: opts.project,
      initialInput: opts.input,
      images,
      maxIterations: opts.maxIter,
      onEvent: (e) => {
        const icon =
          e.kind === "start"
            ? "[>]"
            : e.kind === "finish"
              ? "[.]"
              : e.kind === "handoff"
                ? "[->]"
                : "[x]";
        console.log(`${icon} ${e.agent}${e.summary ? " — " + e.summary : ""}${e.next ? " -> " + e.next : ""}`);
      },
    });
    console.log("\n=== Resultado ===");
    console.log(`sessionId: ${result.sessionId}`);
    console.log(`projectId: ${result.projectId}`);
    console.log(`status:    ${result.status}`);
    console.log(`resumo:    ${result.summary}`);
    process.exit(result.status === "completed" ? 0 : 1);
  });

program
  .command("memory:list")
  .description("Lista os fatos globais aprendidos para um actor")
  .requiredOption("--actor <id>")
  .action((opts) => {
    const facts = globalMemory.listFacts(opts.actor);
    console.log(JSON.stringify(facts, null, 2));
  });

program
  .command("memory:add")
  .description("Adiciona manualmente um fato global")
  .requiredOption("--actor <id>")
  .requiredOption("--kind <kind>", "preference|pattern|rule|lesson")
  .requiredOption("--text <texto>")
  .option("--confidence <n>", "0..1", (v) => parseFloat(v), 0.9)
  .action((opts) => {
    const created = globalMemory.addFact({
      actorId: opts.actor,
      kind: opts.kind,
      text: opts.text,
      confidence: opts.confidence,
    });
    console.log(JSON.stringify(created, null, 2));
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}
