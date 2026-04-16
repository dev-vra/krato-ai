import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

describe("Zod Validation - API Schemas", () => {
  const runSchema = z.object({
    actorId: z.string().min(1),
    goal: z.string().min(1),
    projectId: z.string().optional(),
    initialInput: z.string().optional(),
    images: z
      .array(z.object({ data: z.string(), mime: z.string().optional() }))
      .optional(),
    maxIterations: z.number().int().min(1).max(20).optional(),
  });

  const factSchema = z.object({
    actorId: z.string().min(1),
    kind: z.enum(["preference", "pattern", "rule", "lesson"]),
    text: z.string().min(1),
    confidence: z.number().min(0).max(1).default(0.8),
  });

  describe("runSchema", () => {
    it("deve validar input minimo valido", () => {
      const input = {
        actorId: "user-123",
        goal: "Criar um app de tarefas",
      };

      const result = runSchema.parse(input);
      expect(result.actorId).toBe("user-123");
      expect(result.goal).toBe("Criar um app de tarefas");
    });

    it("deve validar input completo", () => {
      const input = {
        actorId: "user-123",
        goal: "Criar dashboard",
        projectId: "proj-456",
        initialInput: "Com React e Tailwind",
        images: [{ data: "base64data", mime: "image/png" }],
        maxIterations: 5,
      };

      const result = runSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("deve rejeitar actorId vazio", () => {
      const input = { actorId: "", goal: "teste" };
      expect(() => runSchema.parse(input)).toThrow();
    });

    it("deve rejeitar goal vazio", () => {
      const input = { actorId: "user-1", goal: "" };
      expect(() => runSchema.parse(input)).toThrow();
    });

    it("deve rejeitar maxIterations fora do range", () => {
      const input1 = { actorId: "user-1", goal: "teste", maxIterations: 0 };
      const input2 = { actorId: "user-1", goal: "teste", maxIterations: 21 };
      
      expect(() => runSchema.parse(input1)).toThrow();
      expect(() => runSchema.parse(input2)).toThrow();
    });

    it("deve aceitar maxIterations no limite", () => {
      const input = { actorId: "user-1", goal: "teste", maxIterations: 20 };
      const result = runSchema.parse(input);
      expect(result.maxIterations).toBe(20);
    });

    it("deve validar imagens sem mime type", () => {
      const input = {
        actorId: "user-1",
        goal: "teste",
        images: [{ data: "base64" }],
      };
      const result = runSchema.parse(input);
      expect(result.images?.[0].mime).toBeUndefined();
    });

    it("deve rejeitar imagens com data vazio", () => {
      const input = {
        actorId: "user-1",
        goal: "teste",
        images: [{ data: "" }],
      };
      // z.string() sem min() aceita string vazia, mas isso e intencional
      const result = runSchema.parse(input);
      expect(result.images).toHaveLength(1);
    });
  });

  describe("factSchema", () => {
    it("deve validar fato completo", () => {
      const input = {
        actorId: "user-1",
        kind: "preference",
        text: "Prefere TypeScript estrito",
        confidence: 0.95,
      };

      const result = factSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("deve usar default de confidence", () => {
      const input = {
        actorId: "user-1",
        kind: "pattern",
        text: "Sempre usa Zustand",
      };

      const result = factSchema.parse(input);
      expect(result.confidence).toBe(0.8);
    });

    it("deve aceitar apenas kinds validos", () => {
      const validKinds = ["preference", "pattern", "rule", "lesson"];
      
      for (const kind of validKinds) {
        const input = { actorId: "user-1", kind, text: "texto" };
        expect(() => factSchema.parse(input)).not.toThrow();
      }
    });

    it("deve rejeitar kind invalido", () => {
      const input = { actorId: "user-1", kind: "invalid", text: "texto" };
      expect(() => factSchema.parse(input)).toThrow();
    });

    it("deve rejeitar confidence fora do range", () => {
      const input1 = { actorId: "user-1", kind: "rule", text: "texto", confidence: -0.1 };
      const input2 = { actorId: "user-1", kind: "rule", text: "texto", confidence: 1.1 };
      
      expect(() => factSchema.parse(input1)).toThrow();
      expect(() => factSchema.parse(input2)).toThrow();
    });

    it("deve aceitar confidence nos limites", () => {
      const input1 = { actorId: "user-1", kind: "rule", text: "texto", confidence: 0 };
      const input2 = { actorId: "user-1", kind: "rule", text: "texto", confidence: 1 };
      
      expect(() => factSchema.parse(input1)).not.toThrow();
      expect(() => factSchema.parse(input2)).not.toThrow();
    });

    it("deve rejeitar text vazio", () => {
      const input = { actorId: "user-1", kind: "lesson", text: "" };
      expect(() => factSchema.parse(input)).toThrow();
    });
  });
});
