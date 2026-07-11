// Tipos espelhando os schemas do backend Kratos.

export type Sphere = "federal" | "estadual" | "municipal" | "nacional";
export type Branch =
  | "executivo"
  | "legislativo"
  | "judiciario"
  | "eleitoral"
  | "independente";
export type Access = "api" | "bulk" | "ckan" | "sql" | "scrape" | "web";

export interface Endpoint {
  label: string;
  url: string;
  kind: string;
}

export interface SourceDefinition {
  id: string;
  name: string;
  short_description: string;
  sphere: Sphere;
  branch: Branch;
  access: Access[];
  categories: string[];
  requires_auth: boolean;
  formats: string[];
  endpoints: Endpoint[];
  uf: string | null;
  notes: string | null;
  has_connector: boolean;
  tags: string[];
}

export interface SourceHit {
  score: number;
  source: SourceDefinition;
}

export interface SearchResponse {
  query: string | null;
  embedder: string;
  total: number;
  hits: SourceHit[];
}

export interface Stats {
  total_sources: number;
  with_connector: number;
  with_api: number;
  requires_auth: number;
  by_sphere: Record<string, number>;
  by_branch: Record<string, number>;
  by_category: Record<string, number>;
}

export interface NormalizedRecord {
  id: string;
  source_id: string;
  kind: string;
  title: string;
  description: string | null;
  entity_name: string | null;
  counterparty_name: string | null;
  counterparty_doc: string | null;
  amount: number | null;
  currency: string;
  occurred_on: string | null;
  uf: string | null;
  municipality: string | null;
  source_url: string | null;
  raw: Record<string, unknown>;
}

export interface ConnectorParam {
  name: string;
  label: string;
  kind: string;
  required: boolean;
  help: string | null;
  options: string[] | null;
}

export interface ConnectorInfo {
  source_id: string;
  label: string;
  params: ConnectorParam[];
}

export interface SearchFilters {
  sphere?: Sphere;
  branch?: Branch;
  access?: Access;
  category?: string;
  uf?: string;
  has_connector?: boolean;
}
