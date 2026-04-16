/**
 * Event Bus para Streaming SSE em Tempo Real
 * Permite que múltiplos clientes se inscrevam em eventos de sessões específicas
 */

import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

export interface StreamEvent {
  type: string;
  sessionId: string;
  timestamp: string;
  data?: unknown;
}

interface ClientSubscription {
  sessionId: string;
  send: (event: StreamEvent) => void;
  onClose: () => void;
}

class EventBus extends EventEmitter {
  private subscriptions: Map<string, Set<ClientSubscription>> = new Map();
  private eventHistory: Map<string, StreamEvent[]> = new Map();
  private readonly MAX_HISTORY = 100;

  /**
   * Inscreve um cliente em uma sessão específica
   */
  subscribe(sessionId: string, send: (event: StreamEvent) => void, onClose: () => void): () => void {
    if (!this.subscriptions.has(sessionId)) {
      this.subscriptions.set(sessionId, new Set());
    }

    const subscription: ClientSubscription = { sessionId, send, onClose };
    this.subscriptions.get(sessionId)!.add(subscription);

    // Envia histórico de eventos recentes
    const history = this.eventHistory.get(sessionId) || [];
    for (const event of history) {
      send(event);
    }

    logger.info({ sessionId, subscribers: this.subscriptions.get(sessionId)!.size }, "client subscribed");

    // Retorna função de unsubscribe
    return () => {
      this.unsubscribe(sessionId, subscription);
    };
  }

  /**
   * Remove inscrição de um cliente
   */
  private unsubscribe(sessionId: string, subscription: ClientSubscription): void {
    const subs = this.subscriptions.get(sessionId);
    if (subs) {
      subs.delete(subscription);
      if (subs.size === 0) {
        this.subscriptions.delete(sessionId);
      }
      logger.info({ sessionId, subscribers: 0 }, "all clients unsubscribed");
    }
  }

  /**
   * Publica um evento para todos os clientes inscritos na sessão
   */
  publish(event: StreamEvent): void {
    const { sessionId } = event;
    event.timestamp = new Date().toISOString();

    // Armazena no histórico
    if (!this.eventHistory.has(sessionId)) {
      this.eventHistory.set(sessionId, []);
    }
    const history = this.eventHistory.get(sessionId)!;
    history.push(event);
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }

    // Notifica todos os clientes inscritos
    const subs = this.subscriptions.get(sessionId);
    if (subs) {
      let removedCount = 0;
      for (const sub of subs) {
        try {
          sub.send(event);
        } catch (err) {
          // Cliente desconectou, marca para remoção
          logger.warn({ sessionId, error: err }, "failed to send event, removing client");
          sub.onClose();
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        // Limpa clientes desconectados
        this.subscriptions.set(
          sessionId,
          new Set([...subs].filter(s => !this.isClientClosed(s)))
        );
      }
    }

    this.emit('event', event);
    logger.debug({ sessionId, type: event.type }, "event published");
  }

  /**
   * Verifica se um cliente ainda está ativo (heurística)
   */
  private isClientClosed(_sub: ClientSubscription): boolean {
    // Em implementação futura, poderíamos trackear estado real do cliente
    return false;
  }

  /**
   * Limpa histórico e inscrições de uma sessão
   */
  clearSession(sessionId: string): void {
    this.eventHistory.delete(sessionId);
    const subs = this.subscriptions.get(sessionId);
    if (subs) {
      for (const sub of subs) {
        sub.onClose();
      }
      this.subscriptions.delete(sessionId);
    }
    logger.info({ sessionId }, "session cleared");
  }

  /**
   * Obtém estatísticas do event bus
   */
  getStats(): { activeSessions: number; totalSubscribers: number; eventsInHistory: number } {
    let totalSubscribers = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscribers += subs.size;
    }

    let totalEvents = 0;
    for (const events of this.eventHistory.values()) {
      totalEvents += events.length;
    }

    return {
      activeSessions: this.subscriptions.size,
      totalSubscribers,
      eventsInHistory: totalEvents,
    };
  }
}

export const eventBus = new EventBus();
