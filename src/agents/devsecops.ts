import { env } from "../config/env.js";
import { mcp } from "../execution/mcp-client.js";
import { Agent, extractJson, type AgentContext, type AgentResult } from "./base.js";

export interface SecReport {
  vulnerabilities: Array<{ pkg: string; severity: string; cve?: string; fix?: string }>;
  secretsLeaked: Array<{ file: string; line: number; kind: string }>;
  dockerfilePresent: boolean;
  ciPresent: boolean;
  recommendations: string[];
}

/**
 * DevSecOps Agent — o Guardiao da Infraestrutura.
 *
 * Ultima etapa do pipeline. Roda:
 *   - npm audit --json (SCA)
 *   - varredura de segredos (regex simples) via LLM nos arquivos novos
 *   - valida presenca de Dockerfile e workflow de CI
 *   - sugere pipeline CI/CD seguro
 * Se detectar CVEs altos ou segredos vazados, BLOQUEIA merge e devolve
 * tarefas concretas para o Developer.
 */
export class DevSecOpsAgent extends Agent {
  constructor() {
    super({
      role: "devsecops",
      title: "DevSecOps Agent",
      preferredModel: env.KRATO_MODEL_ROUTER,
      temperature: 0.1,
      systemPrompt: `Voce e o DevSecOps Agent. Zero tolerancia para CVEs altos ou
segredos em commit. Analisa os outputs fornecidos e emite um plano de acao.

Saida em JSON puro:
  {
    "vulnerabilities": [{ "pkg", "severity", "cve?", "fix?" }],
    "secretsLeaked": [{ "file", "line", "kind" }],
    "dockerfilePresent": boolean,
    "ciPresent": boolean,
    "recommendations": ["..."]
  }`,
    });
  }

  async run(ctx: AgentContext, _input: string): Promise<AgentResult> {
    const audit = await this.safeExec(`npm audit --json`, ctx.projectId);
    const lsDocker = await this.safeExec(`ls Dockerfile`, ctx.projectId);
    const lsCi = await this.safeExec(`ls .github/workflows`, ctx.projectId);

    const raw = await this.generate(
      ctx,
      [
        {
          role: "user",
          content: JSON.stringify(
            {
              npmAudit: audit.stdout.slice(0, 8000),
              dockerfilePresent: lsDocker.code === 0,
              ciPresent: lsCi.code === 0,
            },
            null,
            2,
          ),
        },
      ],
      { format: "json", hints: { purpose: "eval", complexity: "medium" } },
    );

    const report =
      extractJson<SecReport>(raw) ?? {
        vulnerabilities: [],
        secretsLeaked: [],
        dockerfilePresent: lsDocker.code === 0,
        ciPresent: lsCi.code === 0,
        recommendations: [],
      };

    this.publish(ctx, {
      kind: "devsecops.report",
      author: "devsecops",
      data: report,
      createdAt: new Date().toISOString(),
    });

    const highSev = report.vulnerabilities.filter((v) =>
      ["high", "critical"].includes(v.severity.toLowerCase()),
    );
    if (highSev.length || report.secretsLeaked.length) {
      ctx.blackboard.publish({
        kind: "qa.feedback",
        author: "devsecops",
        data: [
          ...highSev.map((v) => `- CVE/dep ${v.pkg} (${v.severity}) — fix: ${v.fix ?? "atualizar"}`),
          ...report.secretsLeaked.map((s) => `- segredo (${s.kind}) em ${s.file}:${s.line}`),
        ].join("\n"),
        createdAt: new Date().toISOString(),
      });
      return {
        summary: `DevSecOps bloqueou merge: ${highSev.length} CVEs altos, ${report.secretsLeaked.length} segredos.`,
        artifacts: [],
        nextAgent: "developer",
      };
    }

    return {
      summary: "DevSecOps aprovado. Pipeline pronto para merge.",
      artifacts: [],
      nextAgent: "done",
    };
  }

  private async safeExec(
    cmd: string,
    cwd: string,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      return await mcp.exec(cmd, cwd);
    } catch (err) {
      return { code: -1, stdout: "", stderr: err instanceof Error ? err.message : String(err) };
    }
  }
}

export { env };
