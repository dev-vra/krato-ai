import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { router } from "../llm/router.js";

/**
 * Cliente minimalista para Qdrant. Usamos fetch direto (sem SDK) para
 * manter o bundle pequeno e nao trazer dependencias binarias alem do
 * absolutamente necessario.
 */

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

const VEC_SIZE = 768; // nomic-embed-text

export class QdrantClient {
  constructor(private baseUrl = env.QDRANT_URL, private apiKey = env.QDRANT_API_KEY) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Qdrant ${path} ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  }

  async ensureCollection(name: string, size = VEC_SIZE): Promise<void> {
    try {
      await this.request(`/collections/${name}`);
    } catch {
      logger.info({ name }, "qdrant: criando collection");
      await this.request(`/collections/${name}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: { size, distance: "Cosine" },
        }),
      });
    }
  }

  async upsert(collection: string, points: VectorPoint[]): Promise<void> {
    await this.request(`/collections/${collection}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({ points }),
    });
  }

  async search(
    collection: string,
    vector: number[],
    limit = 8,
    filter?: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    const res = await this.request<{ result: SearchResult[] }>(
      `/collections/${collection}/points/search`,
      {
        method: "POST",
        body: JSON.stringify({ vector, limit, with_payload: true, filter }),
      },
    );
    return res.result;
  }

  async ping(): Promise<boolean> {
    try {
      await this.request("/");
      return true;
    } catch {
      return false;
    }
  }
}

export const qdrant = new QdrantClient();

/** Helper: gera embedding local via Ollama e devolve o primeiro vetor. */
export async function embed(text: string): Promise<number[]> {
  const [vec] = await router.embed(text);
  if (!vec) throw new Error("falha ao gerar embedding");
  return vec;
}
