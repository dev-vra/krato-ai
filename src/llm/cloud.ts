import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
} from "./types.js";

/**
 * Cliente para "frontier models" na nuvem. Usa a Messages API do Anthropic
 * nativamente quando CLOUD_PROVIDER=anthropic; para OpenAI/Gemini/Ollama-Cloud,
 * usa o cliente OpenAI-compatible (quase todos os provedores modernos o
 * expoem via base_url). Isso nos da um unico fluxo de codigo.
 */
export class CloudProvider implements LLMProvider {
  readonly name = "cloud";
  private openai: OpenAI | null = null;

  constructor() {
    if (!env.CLOUD_API_KEY) {
      logger.info("cloud provider desabilitado (CLOUD_API_KEY vazia)");
      return;
    }
    this.openai = new OpenAI({
      apiKey: env.CLOUD_API_KEY,
      baseURL: this.resolveBaseUrl(),
    });
  }

  get enabled(): boolean {
    return this.openai !== null;
  }

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    if (!this.openai) {
      throw new Error("cloud provider nao configurado (defina CLOUD_API_KEY)");
    }
    const model = options.model ?? env.CLOUD_MODEL;
    const started = Date.now();

    const response = await this.openai.chat.completions.create({
      model,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      response_format: options.format === "json" ? { type: "json_object" } : undefined,
      messages: messages.map((m) => this.toOpenAIMessage(m)),
    });

    const text = response.choices[0]?.message?.content ?? "";
    const latencyMs = Date.now() - started;

    logger.debug(
      { model, latencyMs, provider: env.CLOUD_PROVIDER },
      "cloud.generate done",
    );

    return {
      text,
      model,
      route: "cloud",
      latencyMs,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      },
    };
  }

  async embed(): Promise<number[][]> {
    throw new Error("embeddings devem ser feitos localmente via Ollama");
  }

  private resolveBaseUrl(): string | undefined {
    if (env.CLOUD_BASE_URL) return env.CLOUD_BASE_URL;
    switch (env.CLOUD_PROVIDER) {
      case "anthropic":
        return "https://api.anthropic.com/v1";
      case "google":
        return "https://generativelanguage.googleapis.com/v1beta/openai";
      case "ollama-cloud":
        return "https://ollama.com/api";
      case "openai":
      default:
        return undefined; // padrao da SDK
    }
  }

  private toOpenAIMessage(m: ChatMessage): OpenAI.Chat.Completions.ChatCompletionMessageParam {
    if (typeof m.content === "string") {
      return { role: m.role as "system" | "user" | "assistant", content: m.content };
    }
    const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = m.content.map((c) => {
      if (c.type === "image") {
        const url = c.data.startsWith("http")
          ? c.data
          : `data:${c.mime ?? "image/png"};base64,${c.data}`;
        return { type: "image_url", image_url: { url } };
      }
      return { type: "text", text: c.text };
    });
    return {
      role: m.role as "user" | "assistant" | "system",
      content: parts as never,
    };
  }
}

export const cloud = new CloudProvider();
