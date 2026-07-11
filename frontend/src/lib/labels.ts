import type { Access, Branch, Sphere } from "./types";

export const SPHERE_LABEL: Record<Sphere, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
  nacional: "Nacional",
};

export const SPHERE_COLOR: Record<Sphere, string> = {
  federal: "#6a5cf0",
  estadual: "#0ea5a4",
  municipal: "#f59e0b",
  nacional: "#3b82f6",
};

export const BRANCH_LABEL: Record<Branch, string> = {
  executivo: "Executivo",
  legislativo: "Legislativo",
  judiciario: "Judiciário",
  eleitoral: "Eleitoral",
  independente: "Independente / Aberto",
};

export const ACCESS_LABEL: Record<Access, string> = {
  api: "API REST",
  bulk: "Download em lote",
  ckan: "Catálogo CKAN",
  sql: "SQL / BigQuery",
  scrape: "Scraping",
  web: "Consulta web",
};

export const CATEGORY_LABEL: Record<string, string> = {
  despesas: "Despesas",
  receitas: "Receitas",
  salarios: "Salários",
  cartoes_corporativos: "Cartões corporativos",
  licitacoes: "Licitações",
  contratos: "Contratos",
  empresas: "Empresas",
  sancoes: "Sanções",
  campanhas_eleitorais: "Campanhas eleitorais",
  servidores: "Servidores",
  legislativo: "Legislativo",
  diarios_oficiais: "Diários oficiais",
  fiscal_contabil: "Fiscal / contábil",
  beneficios_sociais: "Benefícios sociais",
  convenios_emendas: "Convênios / emendas",
};

// Paleta categórica de dataviz — consistente em toda a aplicação.
export const CATEGORY_COLOR: Record<string, string> = {
  despesas: "#6a5cf0",
  contratos: "#0ea5a4",
  licitacoes: "#14b8a6",
  sancoes: "#ef5da8",
  campanhas_eleitorais: "#f59e0b",
  fiscal_contabil: "#3b82f6",
  servidores: "#8b5cf6",
  salarios: "#a855f7",
  receitas: "#22c55e",
  diarios_oficiais: "#f97316",
  empresas: "#64748b",
};

export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c;
export const categoryColor = (c: string) => CATEGORY_COLOR[c] ?? "#94a3b8";
