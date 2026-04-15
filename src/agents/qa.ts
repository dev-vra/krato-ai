import { env } from "../config/env.js";
import { mcp } from "../execution/mcp-client.js";
import { Agent, extractJson, type AgentContext, type AgentResult } from "./base.js";

export interface QAReport {
  passed: boolean;
  failures: Array<{ file?: string; test?: string; message: string }>;
  coverageGaps: string[];
  suggestions: string[];
}

/**
 * QA & Testing Agent — o Inquisidor.
 *
 * Evaluator independente que:
 *   1) Roda `npm run typecheck`, `npm test`, `npm run lint` via MCP.
 *   2) Analisa os outputs com um LLM DIFERENTE do Developer (evita vies
 *      de confirmacao: deepseek-coder-v2 vs qwen2.5-coder).
 *   3) Decide entre "passed" (segue para devsecops) ou "rejected" (volta
 *      para o developer com feedback acionavel — loop Evaluator-Optimizer).
 */
export class QAAgent extends Agent {
  constructor() {
    super({
      role: "qa",
      title: "QA & Testing Agent",
      preferredModel: env.KRATO_MODEL_EVAL,
      temperature: 0.1,
      systemPrompt: `Voce e o QA & Testing Agent. Seu papel e INSPETOR, nao autor.
Voce recebe logs de typecheck, testes e lint. Voce nunca confia no autor do
codigo; sua missao e encontrar falhas reais. Casos de borda, estados nao
tratados, violacoes de tipos, regressoes — tudo conta.

Saida: JSON puro:
  {
    "passed": boolean,
    "failures": [{ "file"?, "test"?, "message": "causa raiz curta" }],
    "coverageGaps": ["caminhos/cenarios sem teste"],
    "suggestions": ["acoes acionaveis para o Developer corrigir"]
  }
Se a suite passou e a cobertura e adequada, passed=true e vetores vazios.`,
    });
  }

  async run(ctx: AgentContext, _input: string): Promise<AgentResult> {
    const logs = await this.runSuites(ctx.projectId);

    const raw = await this.generate(
      ctx,
      [
        {
          role: "user",
          content:
            "Analise os logs abaixo e emita o relatorio QA.\n\n" +
            JSON.stringify(logs, null, 2),
        },
      ],
      { format: "json", hints: { purpose: "eval", complexity: "medium" } },
    );

    const report =
      extractJson<QAReport>(raw) ?? {
        passed: logs.every((l) => l.code === 0),
        failures: logs
          .filter((l) => l.code !== 0)
          .map((l) => ({ test: l.cmd, message: l.stderr.slice(0, 400) })),
        coverageGaps: [],
        suggestions: [],
      };

    this.publish(ctx, {
      kind: "qa.report",
      author: "qa",
      data: report,
      createdAt: new Date().toISOString(),
    });

    if (!report.passed) {
      const feedback = [
        ...report.failures.map((f) => `- ${f.test ?? f.file ?? "?"}: ${f.message}`),
        ...report.suggestions.map((s) => `- sugestao: ${s}`),
      ].join("\n");
      ctx.blackboard.publish({
        kind: "qa.feedback",
        author: "qa",
        data: feedback,
        createdAt: new Date().toISOString(),
      });
      return {
        summary: `QA reprovou: ${report.failures.length} falha(s). Retornando ao Developer.`,
        artifacts: [],
        nextAgent: "developer",
      };
    }

    return {
      summary: "QA aprovou. Passando ao DevSecOps.",
      artifacts: [],
      nextAgent: "devsecops",
    };
  }

  private async runSuites(projectId: string): Promise<
    Array<{ cmd: string; code: number; stdout: string; stderr: string }>
  > {
    const suites = ["npm run typecheck", "npm test --silent", "npm run lint"];
    const results: Array<{ cmd: string; code: number; stdout: string; stderr: string }> = [];
    for (const cmd of suites) {
      try {
        const r = await mcp.exec(cmd, projectId);
        results.push({ cmd, code: r.code, stdout: r.stdout.slice(-4000), stderr: r.stderr.slice(-4000) });
      } catch (err) {
        results.push({
          cmd,
          code: -1,
          stdout: "",
          stderr: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }
}
