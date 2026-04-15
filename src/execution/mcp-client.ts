import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { decide, defaultPolicy, type ExecPolicy } from "./policy.js";

/**
 * Cliente MCP — falado com o MCP server que roda na maquina local do
 * desenvolvedor (dentro da Tailnet). Usamos JSON-RPC 2.0 sobre HTTP.
 *
 * Protocolo (simplificado — compativel com o espirito do Model Context
 * Protocol, mas sem exigir um SDK oficial no MVP):
 *
 *   POST /rpc  { jsonrpc: "2.0", id, method, params }
 *
 * Metodos expostos pelo MCP server:
 *   - exec(cmd, cwd?)          -> roda um comando restrito
 *   - readFile(path)           -> le arquivo dentro do workspace
 *   - writeFile(path, content) -> escreve (cria pastas)
 *   - listDir(path)            -> lista diretorio
 *   - approve(requestId)       -> devolve true apos aprovacao humana
 */

export interface McpExecResult {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ApprovalHandler {
  (command: string, meta: Record<string, unknown>): Promise<boolean>;
}

export class McpClient {
  private seq = 0;

  constructor(
    private url: string = env.MCP_URL,
    private token: string = env.MCP_TOKEN,
    private policy: ExecPolicy = defaultPolicy,
    private approvalHandler?: ApprovalHandler,
  ) {}

  get configured(): boolean {
    return Boolean(this.url && this.token);
  }

  setApprovalHandler(handler: ApprovalHandler): void {
    this.approvalHandler = handler;
  }

  private async rpc<T>(method: string, params: unknown = {}): Promise<T> {
    if (!this.configured) {
      throw new Error("MCP_URL/MCP_TOKEN nao configurados");
    }
    const id = ++this.seq;
    const res = await fetch(`${this.url}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    if (!res.ok) throw new Error(`MCP ${method} HTTP ${res.status}`);
    const body = (await res.json()) as {
      result?: T;
      error?: { code: number; message: string };
    };
    if (body.error) throw new Error(`MCP ${method}: ${body.error.message}`);
    return body.result as T;
  }

  async exec(command: string, cwd?: string): Promise<McpExecResult> {
    const decision = decide(this.policy, command);
    if (decision === "deny") {
      throw new Error(`policy: comando negado -> "${command}"`);
    }
    if (decision === "approval" && env.MCP_REQUIRE_APPROVAL) {
      const approved = this.approvalHandler
        ? await this.approvalHandler(command, { cwd })
        : false;
      if (!approved) throw new Error(`HITL: aprovacao negada para "${command}"`);
    }
    logger.info({ command, cwd, decision }, "mcp.exec");
    return this.rpc<McpExecResult>("exec", { command, cwd });
  }

  readFile(path: string): Promise<string> {
    return this.rpc<string>("readFile", { path });
  }

  writeFile(path: string, content: string): Promise<void> {
    return this.rpc<void>("writeFile", { path, content });
  }

  listDir(path: string): Promise<string[]> {
    return this.rpc<string[]>("listDir", { path });
  }

  async ping(): Promise<boolean> {
    try {
      await this.rpc("ping");
      return true;
    } catch {
      return false;
    }
  }
}

export const mcp = new McpClient();
