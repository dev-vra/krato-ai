import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { cloud } from "./cloud.js";
import { ollama } from "./ollama.js";
import type {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
} from "./types.js";

/**
 * Router hibrido: decide entre inferencia local (Ollama/VPS) e nuvem
 * (Anthropic/OpenAI/etc.) seguindo a piramide de delegacao descrita
 * no documento de arquitetura.
 *
 * Heuristicas:
 *  - multimodal (imagens de Figma/wireframes)    -> nuvem
 *  - complexidade alta (ex: plano arquitetural)  -> nuvem
 *  - prompt > CLOUD_ESCALATE_ON_TOKENS tokens   -> nuvem
 *  - falhas consecutivas locais                  -> nuvem (fallback)
 *  - qualquer outro caso                         -> local
 */
export class HybridRouter implements LLMProvider {
  readonly name = "hybrid";
  private consecutiveLocalFailures = 0;

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    const route = this.decide(messages, options);
    logger.debug({ route, hints: options.hints }, "router.decide");

    if (route === "cloud" && cloud.enabled) {
      try {
        const result = await cloud.generate(messages, options);
        this.consecutiveLocalFailures = 0;
        return result;
      } catch (err) {
        logger.warn({ err }, "cloud failed, falling back to local");
        // tentativa final local para nao bloquear o pipeline
        return ollama.generate(messages, options);
      }
    }

    try {
      const result = await ollama.generate(messages, options);
      this.consecutiveLocalFailures = 0;
      return result;
    } catch (err) {
      this.consecutiveLocalFailures++;
      logger.warn(
        { err, consecutive: this.consecutiveLocalFailures },
        "local generate failed",
      );
      if (cloud.enabled) {
        logger.info("escalando para nuvem apos falha local");
        return cloud.generate(messages, options);
      }
      throw err;
    }
  }

  async embed(input: string | string[], model?: string): Promise<number[][]> {
    // Embeddings SEMPRE locais: baratos, deterministicos, sem round-trip.
    return ollama.embed(input, model);
  }

  private decide(messages: ChatMessage[], options: GenerateOptions): "local" | "cloud" {
    if (!cloud.enabled) return "local";

    const hints = options.hints ?? {};
    if (hints.multimodal && env.CLOUD_ESCALATE_ON_MULTIMODAL) return "cloud";
    if (hints.complexity === "high") return "cloud";

    const promptSize = this.approxTokens(messages);
    if (promptSize > env.CLOUD_ESCALATE_ON_TOKENS) return "cloud";

    if (this.consecutiveLocalFailures >= env.CLOUD_ESCALATE_ON_FAILURES) return "cloud";

    return "local";
  }

  private approxTokens(messages: ChatMessage[]): number {
    // Estimativa grosseira: 4 chars por token. Suficiente para decisoes
    // de roteamento (nao usamos tokenizer real para economizar latencia).
    let chars = 0;
    for (const m of messages) {
      if (typeof m.content === "string") {
        chars += m.content.length;
      } else {
        for (const p of m.content) {
          if (p.type === "text") chars += p.text.length;
          else chars += 1500; // imagens contam como bloco grande
        }
      }
    }
    return Math.ceil(chars / 4);
  }
}

export const router = new HybridRouter();
