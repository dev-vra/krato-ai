import { env } from "../config/env.js";
import { Agent, extractJson, type AgentContext, type AgentResult } from "./base.js";

export interface PRD {
  name: string;
  vision: string;
  personas: string[];
  userStories: Array<{ id: string; as: string; want: string; so: string }>;
  nonFunctional: string[];
  openQuestions: string[];
}

export interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  status: "proposed" | "accepted";
}

export interface ProductOutput {
  prd: PRD;
  adrs: ADR[];
  stackRecommendation: {
    frontend: string;
    backend: string;
    database: string;
    testing: string;
    deployment: string;
  };
}

/**
 * Product & Architecture Agent — o Visionario Analitico.
 *
 * Traduz intencao ambigua do humano em um PRD estruturado + ADRs
 * iniciais. Escreve SEMPRE em JSON para que o handoff seja deterministico.
 */
export class ProductAgent extends Agent {
  constructor() {
    super({
      role: "product",
      title: "Product & Architecture Agent",
      preferredModel: env.KRATO_MODEL_ROUTER,
      temperature: 0.3,
      systemPrompt: `Voce e o Product & Architecture Agent do Krato-AI.
Responsabilidade: transformar a intencao do usuario em um PRD (Product Requirements
Document) completo e um conjunto inicial de ADRs (Architecture Decision Records),
alem de recomendar a stack JS/TS que o time deve usar.

Regras:
- Stack padrao 2025: React 19 + Next.js 15 (App Router, Server Components), TypeScript
  strict, TanStack Query para estado assincrono, Zustand para estado global leve,
  Tailwind para estilos, Vitest + Playwright para testes, PostgreSQL (+ pgvector
  se houver semantica), Docker para deploy, Trunk-Based Development.
- Organize o codigo por feature (DDD), nao por tipo de artefato.
- Liste perguntas em aberto quando houver ambiguidade — nunca invente requisitos.

Formato de resposta: JSON puro com as chaves:
  prd: { name, vision, personas[], userStories[{id,as,want,so}], nonFunctional[], openQuestions[] }
  adrs: [{ id, title, context, decision, consequences[], status }]
  stackRecommendation: { frontend, backend, database, testing, deployment }`,
    });
  }

  async run(ctx: AgentContext, input: string): Promise<AgentResult> {
    const raw = await this.generate(
      ctx,
      [
        {
          role: "user",
          content: `Objetivo do projeto: ${ctx.goal}\n\nInput adicional do usuario:\n${input}`,
        },
      ],
      { format: "json", hints: { complexity: "high" } },
    );

    const parsed = extractJson<ProductOutput>(raw);
    if (!parsed) {
      return {
        summary: "Falha ao gerar PRD estruturado.",
        artifacts: [
          this.publish(ctx, {
            kind: "product.raw",
            author: "product",
            data: { raw },
            createdAt: new Date().toISOString(),
          }),
        ],
        nextAgent: "done",
      };
    }

    this.publish(ctx, {
      kind: "product.prd",
      author: "product",
      data: parsed.prd,
      createdAt: new Date().toISOString(),
    });
    this.publish(ctx, {
      kind: "product.adrs",
      author: "product",
      data: parsed.adrs,
      createdAt: new Date().toISOString(),
    });
    this.publish(ctx, {
      kind: "product.stack",
      author: "product",
      data: parsed.stackRecommendation,
      createdAt: new Date().toISOString(),
    });

    return {
      summary: `PRD "${parsed.prd.name}" com ${parsed.prd.userStories.length} user stories e ${parsed.adrs.length} ADRs.`,
      artifacts: [],
      nextAgent: "design",
    };
  }
}
