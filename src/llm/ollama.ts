import { Ollama } from "ollama";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type {
  ChatMessage,
  ContentPart,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
} from "./types.js";

/**
 * Cliente de inferencia local via Ollama. Configurado para maquinas de
 * recursos limitados (VPS 12GB): quantizacoes 4-bit, keep_alive agressivo
 * para evitar recarregamento custoso do disco NVMe, numero de threads
 * sincronizado com os nucleos fisicos.
 */
export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private client: Ollama;

  constructor(host: string = env.OLLAMA_HOST) {
    this.client = new Ollama({ host });
  }

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    const model = options.model ?? env.KRATO_MODEL_ROUTER;
    const started = Date.now();

    const ollamaMessages = messages.map((m) => this.toOllamaMessage(m));

    const response = await this.client.chat({
      model,
      messages: ollamaMessages,
      stream: false,
      format: options.format === "json" ? "json" : undefined,
      keep_alive: env.OLLAMA_KEEP_ALIVE,
      options: {
        temperature: options.temperature ?? 0.2,
        num_thread: env.OLLAMA_NUM_THREAD,
        num_predict: options.maxTokens ?? -1,
      },
    });

    const latencyMs = Date.now() - started;
    logger.debug(
      { model, latencyMs, purpose: options.hints?.purpose },
      "ollama.generate done",
    );

    return {
      text: response.message?.content ?? "",
      model,
      route: "local",
      latencyMs,
      usage: {
        promptTokens: response.prompt_eval_count,
        completionTokens: response.eval_count,
      },
    };
  }

  async embed(input: string | string[], model = env.KRATO_MODEL_EMBED): Promise<number[][]> {
    const inputs = Array.isArray(input) ? input : [input];
    const result = await this.client.embed({ model, input: inputs });
    return result.embeddings;
  }

  /** Verifica se o daemon esta vivo e lista modelos disponiveis. */
  async ping(): Promise<{ ok: boolean; models: string[] }> {
    try {
      const list = await this.client.list();
      return { ok: true, models: list.models.map((m) => m.name) };
    } catch (err) {
      logger.warn({ err }, "ollama ping failed");
      return { ok: false, models: [] };
    }
  }

  private toOllamaMessage(m: ChatMessage): {
    role: string;
    content: string;
    images?: string[];
  } {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    const text = m.content
      .filter((c): c is Extract<ContentPart, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const images = m.content
      .filter((c): c is Extract<ContentPart, { type: "image" }> => c.type === "image")
      .map((c) => c.data);
    return images.length
      ? { role: m.role, content: text, images }
      : { role: m.role, content: text };
  }
}

export const ollama = new OllamaProvider();
