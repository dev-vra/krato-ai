/**
 * Tipos comuns da camada de LLM. Todos os provedores (Ollama local, Anthropic,
 * OpenAI, Google) convergem para este formato para que o roteador possa
 * escolher a rota sem que os agentes saibam quem executou a inferencia.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface ImagePart {
  type: "image";
  /** Base64 puro (sem prefixo data:) ou URL publica. */
  data: string;
  mime?: string;
}

export interface TextPart {
  type: "text";
  text: string;
}

export type ContentPart = TextPart | ImagePart;

export interface ChatMessage {
  role: Role;
  content: string | ContentPart[];
  name?: string;
}

export interface GenerateOptions {
  /** Modelo alvo (sobrescreve o padrao do provedor). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Formato desejado: "json" forca resposta JSON quando suportado. */
  format?: "json" | "text";
  /** Sinais contextuais usados pelo roteador hibrido. */
  hints?: {
    multimodal?: boolean;
    complexity?: "low" | "medium" | "high";
    purpose?: "route" | "code" | "eval" | "design" | "plan";
  };
  /** Limite de tentativas antes de escalar para nuvem. */
  maxRetries?: number;
  /** Token signal para abortar. */
  signal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  /** Modelo efetivamente usado (pode diferir do solicitado). */
  model: string;
  /** "local" (Ollama/VPS) ou "cloud". */
  route: "local" | "cloud";
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: string;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult>;
  embed(input: string | string[], model?: string): Promise<number[][]>;
}
