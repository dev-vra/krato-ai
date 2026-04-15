/**
 * Krato-AI MCP Server — roda na MAQUINA LOCAL do desenvolvedor.
 *
 * Responsabilidade: receber requisicoes JSON-RPC da VPS (via Tailscale)
 * e executar comandos/io estritamente dentro de um workspace sandbox.
 *
 * Regras inegociaveis:
 *   - Todo IO e confinado em MCP_WORKSPACE (com resolucao absoluta).
 *   - Comandos passam por allowlist local (defesa em profundidade).
 *   - Nao roda com privilegio root.
 *   - Aceita apenas Bearer token compartilhado.
 *   - Loga toda requisicao (audit trail).
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";

const PORT = Number(process.env.KRATO_MCP_PORT ?? 8787);
const HOST = process.env.KRATO_MCP_HOST ?? "0.0.0.0";
const TOKEN = process.env.KRATO_MCP_TOKEN ?? "";
const WORKSPACE = expandHome(
  process.env.KRATO_MCP_WORKSPACE ?? "~/workspace/krato-projects",
);

if (!TOKEN) {
  console.error("[krato-mcp] KRATO_MCP_TOKEN obrigatorio");
  process.exit(1);
}
if (process.getuid?.() === 0) {
  console.error("[krato-mcp] recusando rodar como root");
  process.exit(1);
}

// Allowlist local (defesa em profundidade — a VPS tambem ja filtrou)
const ALLOW = [
  /^git (status|log|diff|add|commit|branch|checkout|init|remote)(\s|$)/,
  /^ls(\s|$)/,
  /^cat\s+/,
  /^mkdir(\s|$)/,
  /^(npm|pnpm|yarn)\s/,
  /^npx\s/,
  /^node\s/,
  /^tsx\s/,
  /^vitest(\s|$)/,
  /^playwright\s/,
];
const DENY = [/sudo/, /rm\s+-rf\s+\//, /\|\s*(sh|bash)\s*$/, /^ssh\s/, /^scp\s/];

await fs.mkdir(WORKSPACE, { recursive: true });

const app = Fastify({ logger: { level: "info" } });

app.addHook("preHandler", async (req, reply) => {
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${TOKEN}`) {
    reply.code(401).send({ error: "unauthorized" });
  }
});

interface RpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

app.post("/rpc", async (req, reply) => {
  const body = req.body as RpcRequest;
  try {
    const result = await dispatch(body.method, body.params ?? {});
    return { jsonrpc: "2.0", id: body.id, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reply
      .code(200)
      .send({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message } });
  }
});

async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "ping":
      return { ok: true, workspace: WORKSPACE, host: os.hostname() };
    case "exec":
      return exec(String(params["command"] ?? ""), params["cwd"] as string | undefined);
    case "readFile":
      return readFile(String(params["path"] ?? ""));
    case "writeFile":
      return writeFile(
        String(params["path"] ?? ""),
        String(params["content"] ?? ""),
      );
    case "listDir":
      return listDir(String(params["path"] ?? ""));
    default:
      throw new Error(`metodo desconhecido: ${method}`);
  }
}

function expandHome(p: string): string {
  if (p.startsWith("~")) return path.join(os.homedir(), p.slice(1));
  return path.resolve(p);
}

function safeJoin(sub: string): string {
  const base = WORKSPACE;
  const abs = path.resolve(base, sub);
  if (!abs.startsWith(base + path.sep) && abs !== base) {
    throw new Error(`path fora do workspace: ${sub}`);
  }
  return abs;
}

async function exec(
  command: string,
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string; durationMs: number }> {
  if (!command) throw new Error("command vazio");
  for (const rx of DENY) if (rx.test(command)) throw new Error("comando negado localmente");
  if (!ALLOW.some((rx) => rx.test(command))) {
    throw new Error("comando fora da allowlist");
  }
  const workdir = cwd ? safeJoin(cwd) : WORKSPACE;
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/sh", ["-c", command], {
      cwd: workdir,
      env: { ...process.env, HOME: os.homedir(), PATH: process.env["PATH"] ?? "" },
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 1000 * 60 * 5);
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        code: code ?? -1,
        stdout: stdout.slice(0, 200_000),
        stderr: stderr.slice(0, 200_000),
        durationMs: Date.now() - started,
      });
    });
  });
}

async function readFile(rel: string): Promise<string> {
  const abs = safeJoin(rel);
  return fs.readFile(abs, "utf8");
}

async function writeFile(rel: string, content: string): Promise<{ bytes: number }> {
  const abs = safeJoin(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return { bytes: Buffer.byteLength(content, "utf8") };
}

async function listDir(rel: string): Promise<string[]> {
  const abs = safeJoin(rel || ".");
  return fs.readdir(abs);
}

const address = await app.listen({ port: PORT, host: HOST });
console.log(`[krato-mcp] ouvindo em ${address}`);
console.log(`[krato-mcp] workspace: ${WORKSPACE}`);
