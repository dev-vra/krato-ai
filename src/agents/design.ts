import { env } from "../config/env.js";
import { Agent, extractJson, type AgentContext, type AgentResult } from "./base.js";
import type { PRD } from "./product.js";

export interface DesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  radii: Record<string, string>;
  typography: { fontFamilies: Record<string, string>; scale: Record<string, string> };
}

export interface ScreenSpec {
  name: string;
  route: string;
  description: string;
  states: string[]; // ex: ["loading","empty","error","default"]
  components: string[]; // ex: ["Header","ProductCard","CheckoutForm"]
  interactions: string[];
}

export interface DesignOutput {
  tokens: DesignTokens;
  screens: ScreenSpec[];
  accessibility: string[];
}

/**
 * UX/UI & Design Agent — o Estrategista Criativo.
 *
 * Ingere o PRD (e, quando houver, imagens de wireframes) e produz:
 *   - Design tokens (cores, espacamentos, tipografia) compativeis com Tailwind.
 *   - Especificacao de telas/estados/componentes que o Dev ira implementar.
 *   - Regras de acessibilidade (WCAG 2.2).
 */
export class DesignAgent extends Agent {
  constructor() {
    super({
      role: "design",
      title: "UX/UI & Design Agent",
      preferredModel: env.KRATO_MODEL_ROUTER,
      temperature: 0.4,
      systemPrompt: `Voce e o UX/UI & Design Agent. Converte PRDs (e wireframes visuais
quando fornecidos) em especificacoes executaveis para o Lead Developer.

Princípios:
- Mobile-first, acessibilidade WCAG 2.2 AA, contraste >= 4.5:1.
- Tokens nomeados (design system) em vez de valores magicos.
- Cada tela lista TODOS os estados possiveis (loading, empty, error, default,
  disabled, hover, focus).
- Sem prosa. Saida sempre JSON puro:
  {
    "tokens": { "colors": {...}, "spacing": {...}, "radii": {...},
                "typography": { "fontFamilies": {...}, "scale": {...} } },
    "screens": [{ "name", "route", "description", "states", "components", "interactions" }],
    "accessibility": [...regras aplicaveis...]
  }`,
    });
  }

  async run(ctx: AgentContext, input: string): Promise<AgentResult> {
    const prd = ctx.blackboard.latest<PRD>("product.prd");
    const images = ctx.blackboard.latest<Array<{ data: string; mime?: string }>>("input.images");

    const userContent: string | Array<{ type: "text"; text: string } | { type: "image"; data: string; mime?: string }> =
      images && images.length
        ? [
            {
              type: "text",
              text: `PRD:\n${JSON.stringify(prd, null, 2)}\n\nConsidere os wireframes anexados. Instrucoes extras: ${input}`,
            },
            ...images.map((img) => ({ type: "image" as const, data: img.data, mime: img.mime })),
          ]
        : `PRD:\n${JSON.stringify(prd, null, 2)}\n\nInstrucoes extras: ${input}`;

    const raw = await this.generate(
      ctx,
      [{ role: "user", content: userContent }],
      {
        format: "json",
        hints: {
          multimodal: Boolean(images && images.length),
          complexity: "medium",
        },
      },
    );

    const parsed = extractJson<DesignOutput>(raw);
    if (!parsed) {
      this.logger.warn("design output sem JSON valido");
      return { summary: "Design falhou", artifacts: [], nextAgent: "done" };
    }

    this.publish(ctx, {
      kind: "design.tokens",
      author: "design",
      data: parsed.tokens,
      createdAt: new Date().toISOString(),
    });
    this.publish(ctx, {
      kind: "design.screens",
      author: "design",
      data: parsed.screens,
      createdAt: new Date().toISOString(),
    });
    this.publish(ctx, {
      kind: "design.accessibility",
      author: "design",
      data: parsed.accessibility,
      createdAt: new Date().toISOString(),
    });

    return {
      summary: `Design com ${parsed.screens.length} telas e tokens definidos.`,
      artifacts: [],
      nextAgent: "developer",
    };
  }
}
