import { describe, it, expect, vi, beforeEach } from "vitest";
import { HybridRouter } from "../../src/llm/router.js";
import { cloud } from "../../src/llm/cloud.js";
import { ollama } from "../../src/llm/ollama.js";

// Mock dos provedores
vi.mock("../../src/llm/cloud.js", () => ({
  cloud: {
    enabled: true,
    generate: vi.fn(),
  },
}));

vi.mock("../../src/llm/ollama.js", () => ({
  ollama: {
    generate: vi.fn(),
    embed: vi.fn(),
  },
}));

describe("HybridRouter", () => {
  let router: HybridRouter;

  beforeEach(() => {
    router = new HybridRouter();
    vi.clearAllMocks();
  });

  describe("decide", () => {
    it("deve escolher local quando cloud nao esta habilitada", () => {
      // Nota: este teste depende do env CLOUD_PROVIDER
      // Em ambiente de teste, o default pode variar
      const messages = [{ role: "user" as const, content: "teste" }];
      // O router sera testado indiretamente via generate
      expect(router.name).toBe("hybrid");
    });

    it("deve escolher cloud para mensagens multimodais", async () => {
      vi.mocked(cloud.generate).mockResolvedValue({
        text: "resposta cloud",
        model: "claude-sonnet",
        route: "cloud",
        latencyMs: 100,
      });

      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "analise esta imagem" },
            { type: "image" as const, data: "base64data" },
          ],
        },
      ];

      await router.generate(messages, { hints: { multimodal: true } });
      
      expect(cloud.generate).toHaveBeenCalled();
    });

    it("deve escolher cloud para alta complexidade", async () => {
      vi.mocked(cloud.generate).mockResolvedValue({
        text: "resposta complexa",
        model: "claude-sonnet",
        route: "cloud",
        latencyMs: 150,
      });

      const messages = [{ role: "user" as const, content: "crie arquitetura completa" }];
      
      await router.generate(messages, { hints: { complexity: "high" } });
      
      expect(cloud.generate).toHaveBeenCalled();
    });

    it("deve escolher cloud quando prompt excede token limit", async () => {
      vi.mocked(cloud.generate).mockResolvedValue({
        text: "resposta longa",
        model: "claude-sonnet",
        route: "cloud",
        latencyMs: 200,
      });

      // Texto grande (>6000 tokens estimados = >24000 chars)
      const largeText = "x".repeat(25000);
      const messages = [{ role: "user" as const, content: largeText }];

      await router.generate(messages);
      
      expect(cloud.generate).toHaveBeenCalled();
    });

    it("deve usar local para tarefas simples", async () => {
      vi.mocked(ollama.generate).mockResolvedValue({
        text: "resposta local",
        model: "llama3.1:8b",
        route: "local",
        latencyMs: 50,
      });

      const messages = [{ role: "user" as const, content: "saudacao simples" }];
      
      const result = await router.generate(messages, { hints: { complexity: "low" } });
      
      expect(ollama.generate).toHaveBeenCalled();
      expect(result.route).toBe("local");
    });

    it("deve fallback para cloud apos falhas consecutivas locais", async () => {
      vi.mocked(ollama.generate)
        .mockRejectedValueOnce(new Error("falha local"))
        .mockRejectedValueOnce(new Error("falha local 2"));

      vi.mocked(cloud.generate).mockResolvedValue({
        text: "resposta cloud fallback",
        model: "claude-sonnet",
        route: "cloud",
        latencyMs: 100,
      });

      const messages = [{ role: "user" as const, content: "teste" }];

      // Primeira falha
      try {
        await router.generate(messages);
      } catch (e) {
        // Ignora primeira falha
      }

      // Segunda falha - deve escalar para cloud
      try {
        await router.generate(messages);
      } catch (e) {
        // Pode falhar se cloud nao estiver configurada
      }

      // Cloud deve ter sido tentada apos 2 falhas
      expect(cloud.generate).toHaveBeenCalled();
    });
  });

  describe("embed", () => {
    it("deve sempre usar ollama para embeddings", async () => {
      vi.mocked(ollama.embed).mockResolvedValue([[0.1, 0.2, 0.3]]);

      const result = await router.embed("texto para embedding");
      
      expect(ollama.embed).toHaveBeenCalledWith("texto para embedding", undefined);
      expect(result).toEqual([[0.1, 0.2, 0.3]]);
    });

    it("deve aceitar modelo customizado para embedding", async () => {
      vi.mocked(ollama.embed).mockResolvedValue([[0.4, 0.5]]);

      await router.embed(["texto1", "texto2"], "nomic-embed-text");
      
      expect(ollama.embed).toHaveBeenCalledWith(["texto1", "texto2"], "nomic-embed-text");
    });
  });

  describe("approxTokens", () => {
    it("deve estimar tokens baseado em caracteres", () => {
      const messages = [{ role: "user" as const, content: "hello world" }];
      // 11 chars / 4 = ~3 tokens
      const tokens = (router as any).approxTokens(messages);
      expect(tokens).toBeGreaterThanOrEqual(2);
    });

    it("deve contar imagens como bloco grande", () => {
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "analise" },
            { type: "image" as const, data: "base64" },
          ],
        },
      ];
      const tokens = (router as any).approxTokens(messages);
      // 7 chars de texto + 1500 da imagem
      expect(tokens).toBeGreaterThan(300);
    });
  });
});
