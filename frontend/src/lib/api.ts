// Cliente da API Kratos com fallback automático para dados mock.
// Se o backend não responder, a UI continua funcional com MOCK_*.

import {
  MOCK_CONNECTORS,
  MOCK_RECORDS,
  MOCK_SOURCES,
  MOCK_STATS,
  mockSearch,
} from "./mock";
import type {
  ConnectorInfo,
  NormalizedRecord,
  SearchFilters,
  SearchResponse,
  SourceDefinition,
  Stats,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

let backendOnline: boolean | null = null;

async function req<T>(path: string, fallback: () => T, init?: RequestInit): Promise<T> {
  if (backendOnline === false) return fallback();
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    backendOnline = true;
    return (await res.json()) as T;
  } catch {
    backendOnline = false;
    return fallback();
  }
}

export const isBackendOnline = () => backendOnline;

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  stats: () => req<Stats>("/api/catalog/stats", () => MOCK_STATS),

  search: (query: string | null, filters: SearchFilters = {}) =>
    req<SearchResponse>(
      `/api/search${qs({ q: query ?? undefined, ...(filters as Record<string, string | boolean>), top_k: 40 })}`,
      () => mockSearch(query),
    ),

  sources: (filters: SearchFilters = {}) =>
    req<SourceDefinition[]>(
      `/api/sources${qs(filters as Record<string, string | boolean>)}`,
      () => MOCK_SOURCES,
    ),

  source: (id: string) =>
    req<SourceDefinition>(
      `/api/sources/${id}`,
      () => MOCK_SOURCES.find((s) => s.id === id) ?? MOCK_SOURCES[0],
    ),

  connectors: () => req<ConnectorInfo[]>("/api/connectors", () => MOCK_CONNECTORS),

  runConnector: (sourceId: string, params: Record<string, unknown>) =>
    req<{ source_id: string; count: number; records: NormalizedRecord[] }>(
      `/api/connectors/${sourceId}/fetch`,
      () => ({ source_id: sourceId, count: MOCK_RECORDS.length, records: MOCK_RECORDS }),
      { method: "POST", body: JSON.stringify(params) },
    ),
};
