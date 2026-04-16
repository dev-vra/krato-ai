import { describe, it, expect, beforeEach, vi } from "vitest";
import { Blackboard } from "../../src/orchestrator/blackboard.js";

describe("Blackboard", () => {
  let bb: Blackboard;

  beforeEach(() => {
    bb = new Blackboard();
  });

  describe("publish", () => {
    it("deve publicar um artefato no blackboard", () => {
      const artifact = {
        kind: "test.artifact",
        author: "product" as const,
        data: { value: 123 },
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      bb.publish(artifact);
      const all = bb.all();
      
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(artifact);
    });

    it("deve acumular multiplos artefatos", () => {
      bb.publish({
        kind: "artifact1",
        author: "product",
        data: { id: 1 },
        createdAt: "2025-01-01T00:00:00.000Z",
      });
      bb.publish({
        kind: "artifact2",
        author: "design",
        data: { id: 2 },
        createdAt: "2025-01-01T00:00:01.000Z",
      });

      expect(bb.all()).toHaveLength(2);
    });
  });

  describe("latest", () => {
    it("deve retornar o ultimo artefato de um tipo especifico", () => {
      bb.publish({
        kind: "prd",
        author: "product",
        data: { version: 1 },
        createdAt: "2025-01-01T00:00:00.000Z",
      });
      bb.publish({
        kind: "prd",
        author: "product",
        data: { version: 2 },
        createdAt: "2025-01-01T00:00:01.000Z",
      });

      const latest = bb.latest<{ version: number }>("prd");
      expect(latest?.version).toBe(2);
    });

    it("deve retornar undefined quando nao houver artefato do tipo", () => {
      const result = bb.latest("inexistente");
      expect(result).toBeUndefined();
    });

    it("deve filtrar por kind exato", () => {
      bb.publish({
        kind: "product.prd",
        author: "product",
        data: { type: "full" },
        createdAt: "2025-01-01T00:00:00.000Z",
      });
      bb.publish({
        kind: "product.adrs",
        author: "product",
        data: { type: "adr" },
        createdAt: "2025-01-01T00:00:01.000Z",
      });

      expect(bb.latest("product.prd")).toEqual({ type: "full" });
      expect(bb.latest("product.adrs")).toEqual({ type: "adr" });
    });
  });

  describe("clear", () => {
    it("deve limpar todos os artefatos", () => {
      bb.publish({
        kind: "test",
        author: "product",
        data: {},
        createdAt: "2025-01-01T00:00:00.000Z",
      });
      
      bb.clear();
      expect(bb.all()).toHaveLength(0);
    });
  });
});
