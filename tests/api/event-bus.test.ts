import { describe, it, expect, beforeEach, vi } from "vitest";
import { eventBus, type StreamEvent } from "../../src/api/event-bus.js";

describe("EventBus", () => {
  beforeEach(() => {
    // Limpa todas as sessoes entre testes
    eventBus.clearSession("test-session-1");
    eventBus.clearSession("test-session-2");
  });

  describe("subscribe/unsubscribe", () => {
    it("deve inscrever cliente em uma sessao", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      const unsubscribe = eventBus.subscribe("test-session-1", send, onClose);
      
      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe("function");
    });

    it("deve remover inscricao ao chamar unsubscribe", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      const unsubscribe = eventBus.subscribe("test-session-1", send, onClose);
      unsubscribe();
      
      // Após unsubscribe, publicar nao deve enviar para este cliente
      eventBus.publish({ sessionId: "test-session-1", type: "test", timestamp: new Date().toISOString() });
      expect(send).not.toHaveBeenCalled();
    });

    it("deve permitir multiplos clientes na mesma sessao", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();
      
      eventBus.subscribe("test-session-1", send1, onClose1);
      eventBus.subscribe("test-session-1", send2, onClose2);
      
      const event: StreamEvent = { sessionId: "test-session-1", type: "test", timestamp: new Date().toISOString() };
      eventBus.publish(event);
      
      expect(send1).toHaveBeenCalledWith(event);
      expect(send2).toHaveBeenCalledWith(event);
    });
  });

  describe("publish", () => {
    it("deve publicar evento para todos os inscritos", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      eventBus.subscribe("test-session-1", send, onClose);
      
      const event: StreamEvent = { 
        sessionId: "test-session-1", 
        type: "agent_start", 
        timestamp: new Date().toISOString(),
        data: { agent: "product" }
      };
      
      eventBus.publish(event);
      
      expect(send).toHaveBeenCalledWith(event);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("deve adicionar timestamp automatico se nao fornecido", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      eventBus.subscribe("test-session-1", send, onClose);
      
      const eventWithoutTimestamp = { sessionId: "test-session-1", type: "test" } as StreamEvent;
      eventBus.publish(eventWithoutTimestamp);
      
      expect(send).toHaveBeenCalled();
      const publishedEvent = send.mock.calls[0][0];
      expect(publishedEvent.timestamp).toBeDefined();
      expect(new Date(publishedEvent.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("deve armazenar evento no historico", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      const event: StreamEvent = { 
        sessionId: "test-session-1", 
        type: "test_event", 
        timestamp: new Date().toISOString()
      };
      
      eventBus.publish(event);
      
      // Inscreve depois de publicar
      eventBus.subscribe("test-session-1", send, onClose);
      
      // Cliente deve receber evento do historico
      expect(send).toHaveBeenCalledWith(event);
    });

    it("deve limitar historico a MAX_HISTORY eventos", () => {
      const events: StreamEvent[] = [];
      for (let i = 0; i < 150; i++) {
        const event: StreamEvent = { 
          sessionId: "test-session-1", 
          type: `event_${i}`, 
          timestamp: new Date().toISOString()
        };
        events.push(event);
        eventBus.publish(event);
      }
      
      const stats = eventBus.getStats();
      expect(stats.eventsInHistory).toBeLessThanOrEqual(100);
    });
  });

  describe("getStats", () => {
    it("deve retornar estatisticas corretas", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const onClose = vi.fn();
      
      eventBus.subscribe("session-stats-1", send1, onClose);
      eventBus.subscribe("session-stats-1", send2, onClose);
      eventBus.subscribe("session-stats-2", send1, onClose);
      
      const stats = eventBus.getStats();
      
      expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
      expect(stats.totalSubscribers).toBeGreaterThanOrEqual(3);
    });

    it("deve atualizar estatisticas apos unsubscribe", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      const initialStats = eventBus.getStats();
      const unsubscribe = eventBus.subscribe("test-session-unsub", send, onClose);
      const afterSubscribe = eventBus.getStats();
      
      expect(afterSubscribe.totalSubscribers).toBeGreaterThan(initialStats.totalSubscribers);
      
      unsubscribe();
      const afterUnsubscribe = eventBus.getStats();
      expect(afterUnsubscribe.totalSubscribers).toBeLessThan(afterSubscribe.totalSubscribers);
    });
  });

  describe("clearSession", () => {
    it("deve limpar historico e inscricoes de uma sessao", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      // Usa ID unico para evitar conflito com outros testes
      const sessionId = `test-session-clear-${Date.now()}`;
      
      // Publica alguns eventos
      eventBus.publish({ sessionId, type: "event1", timestamp: new Date().toISOString() });
      eventBus.publish({ sessionId, type: "event2", timestamp: new Date().toISOString() });
      
      // Inscreve cliente
      eventBus.subscribe(sessionId, send, onClose);
      
      const beforeClear = eventBus.getStats();
      
      // Limpa sessao
      eventBus.clearSession(sessionId);
      
      const afterClear = eventBus.getStats();
      
      // Deve ter menos sessoes ativas apos clear
      expect(afterClear.activeSessions).toBeLessThan(beforeClear.activeSessions);
      
      // Publicar novo evento nao deve ser enviado para clientes removidos
      eventBus.publish({ sessionId, type: "event3", timestamp: new Date().toISOString() });
      expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "event3" }));
    });

    it("deve chamar onClose de todos os clientes", () => {
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();
      const sessionId = `test-session-close-${Date.now()}`;
      
      eventBus.subscribe(sessionId, vi.fn(), onClose1);
      eventBus.subscribe(sessionId, vi.fn(), onClose2);
      
      eventBus.clearSession(sessionId);
      
      expect(onClose1).toHaveBeenCalled();
      expect(onClose2).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("deve lidar graciosamente com erro ao enviar evento", () => {
      const send = vi.fn().mockImplementation(() => {
        throw new Error("Client disconnected");
      });
      const onClose = vi.fn();
      
      eventBus.subscribe("test-session-1", send, onClose);
      
      // Nao deve lancar excecao
      expect(() => {
        eventBus.publish({ sessionId: "test-session-1", type: "test", timestamp: new Date().toISOString() });
      }).not.toThrow();
      
      expect(onClose).toHaveBeenCalled();
    });

    it("deve lidar com sessoes vazias", () => {
      // Publicar para sessao sem inscritos nao deve falhar
      expect(() => {
        eventBus.publish({ sessionId: "non-existent", type: "test", timestamp: new Date().toISOString() });
      }).not.toThrow();
    });

    it("deve lidar com IDs de sessao especiais", () => {
      const send = vi.fn();
      const onClose = vi.fn();
      
      const specialIds = [
        "session-with-dashes-123",
        "session_with_underscores",
        "session.with.dots",
        "session with spaces",
        "123456",
      ];
      
      for (const sessionId of specialIds) {
        eventBus.subscribe(sessionId, send, onClose);
        eventBus.publish({ sessionId, type: "test", timestamp: new Date().toISOString() });
        expect(send).toHaveBeenCalled();
        send.mockClear();
        eventBus.clearSession(sessionId);
      }
    });
  });
});
