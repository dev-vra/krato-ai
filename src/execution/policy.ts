/**
 * Politica de execucao remota (HITL + allowlist).
 *
 * Este arquivo e a fronteira etica do sistema. Qualquer comando que o
 * MCP server (na maquina local do desenvolvedor) aceite executar deve
 * passar por este gatekeeper PRIMEIRO. A regra: allowlist explicita,
 * nao blacklist. O que nao esta listado, nao roda.
 */

export type CommandAllowRule =
  | { type: "exact"; command: string }
  | { type: "prefix"; prefix: string }
  | { type: "regex"; pattern: string };

export interface ExecPolicy {
  /** Comandos permitidos sem aprovacao humana. */
  allow: CommandAllowRule[];
  /** Comandos permitidos apenas com aprovacao explicita (HITL). */
  requireApproval: CommandAllowRule[];
  /** Comandos explicitamente banidos (defesa em profundidade). */
  deny: CommandAllowRule[];
  /** Caminhos (prefixos) onde o MCP server pode ler/escrever. */
  writableRoots: string[];
}

export const defaultPolicy: ExecPolicy = {
  allow: [
    { type: "prefix", prefix: "git status" },
    { type: "prefix", prefix: "git log" },
    { type: "prefix", prefix: "git diff" },
    { type: "prefix", prefix: "git add" },
    { type: "prefix", prefix: "git commit" },
    { type: "prefix", prefix: "git branch" },
    { type: "prefix", prefix: "git checkout -b" },
    { type: "prefix", prefix: "git init" },
    { type: "prefix", prefix: "git remote" },
    { type: "prefix", prefix: "ls " },
    { type: "exact", command: "ls" },
    { type: "prefix", prefix: "cat " },
    { type: "prefix", prefix: "mkdir " },
    { type: "prefix", prefix: "npm install" },
    { type: "prefix", prefix: "npm run " },
    { type: "prefix", prefix: "npm test" },
    { type: "prefix", prefix: "npm run build" },
    { type: "prefix", prefix: "npx create-next-app" },
    { type: "prefix", prefix: "npx create-vite" },
    { type: "prefix", prefix: "npx tsc" },
    { type: "prefix", prefix: "pnpm install" },
    { type: "prefix", prefix: "pnpm add" },
    { type: "prefix", prefix: "pnpm run " },
    { type: "prefix", prefix: "node " },
    { type: "prefix", prefix: "tsx " },
    { type: "prefix", prefix: "vitest" },
    { type: "prefix", prefix: "playwright test" },
  ],
  requireApproval: [
    { type: "prefix", prefix: "rm " },
    { type: "prefix", prefix: "git push" },
    { type: "prefix", prefix: "git reset --hard" },
    { type: "prefix", prefix: "git rebase" },
    { type: "prefix", prefix: "docker " },
    { type: "prefix", prefix: "curl " },
    { type: "prefix", prefix: "wget " },
  ],
  deny: [
    { type: "prefix", prefix: "sudo " },
    { type: "prefix", prefix: "rm -rf /" },
    { type: "regex", pattern: "^rm\\s+-rf\\s+~" },
    { type: "regex", pattern: ">\\s*/dev/" },
    { type: "regex", pattern: "\\|\\s*sh\\s*$" },
    { type: "regex", pattern: "\\|\\s*bash\\s*$" },
    { type: "prefix", prefix: "chmod 777" },
    { type: "prefix", prefix: "ssh " },
    { type: "prefix", prefix: "scp " },
  ],
  writableRoots: ["~/workspace/krato-projects"],
};

export type Decision = "allow" | "approval" | "deny";

export function match(rule: CommandAllowRule, cmd: string): boolean {
  const c = cmd.trim();
  switch (rule.type) {
    case "exact":
      return c === rule.command;
    case "prefix":
      return c.startsWith(rule.prefix);
    case "regex":
      return new RegExp(rule.pattern).test(c);
  }
}

export function decide(policy: ExecPolicy, cmd: string): Decision {
  for (const r of policy.deny) if (match(r, cmd)) return "deny";
  for (const r of policy.allow) if (match(r, cmd)) return "allow";
  for (const r of policy.requireApproval) if (match(r, cmd)) return "approval";
  return "deny"; // fail-closed: o que nao foi autorizado, nao roda
}
