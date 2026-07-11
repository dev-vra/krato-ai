// Dados mock — usados quando o backend não está disponível, para que a
// experiência completa da UI possa ser vista sem subir a stack de dados.

import type {
  ConnectorInfo,
  NormalizedRecord,
  SearchResponse,
  SourceDefinition,
  Stats,
} from "./types";

export const MOCK_SOURCES: SourceDefinition[] = [
  {
    id: "pncp",
    name: "PNCP — Portal Nacional de Contratações Públicas",
    short_description:
      "Repositório unificado de licitações e contratos de todos os entes e Poderes (Lei 14.133/2021).",
    sphere: "nacional",
    branch: "independente",
    access: ["api"],
    categories: ["licitacoes", "contratos", "empresas"],
    requires_auth: false,
    formats: ["JSON"],
    endpoints: [
      { label: "Portal", url: "https://pncp.gov.br", kind: "portal" },
      { label: "API (Swagger)", url: "https://pncp.gov.br/api/consulta/swagger-ui/index.html", kind: "swagger" },
    ],
    uf: null,
    notes: "Obrigatório desde 2023/24; fonte mais completa para compras públicas.",
    has_connector: true,
    tags: ["licitações", "contratos", "compras", "14133"],
  },
  {
    id: "portal_transparencia",
    name: "Portal da Transparência (CGU)",
    short_description:
      "Hub central do Executivo Federal: despesas, servidores, cartões (CPGF), convênios e benefícios.",
    sphere: "federal",
    branch: "executivo",
    access: ["api", "bulk"],
    categories: ["despesas", "salarios", "cartoes_corporativos", "servidores"],
    requires_auth: true,
    formats: ["JSON", "CSV"],
    endpoints: [{ label: "Portal", url: "https://portaldatransparencia.gov.br", kind: "portal" }],
    uf: null,
    notes: "Consultas na tela limitam 20 mil registros.",
    has_connector: true,
    tags: ["cgu", "gastos", "cpgf"],
  },
  {
    id: "camara",
    name: "Câmara dos Deputados — Dados Abertos",
    short_description: "Despesas CEAP com nota fiscal por despesa desde 2008, proposições e votações.",
    sphere: "federal",
    branch: "legislativo",
    access: ["api"],
    categories: ["despesas", "legislativo", "servidores"],
    requires_auth: false,
    formats: ["XML", "JSON", "CSV"],
    endpoints: [{ label: "Portal", url: "https://dadosabertos.camara.leg.br", kind: "portal" }],
    uf: null,
    notes: "Sem autenticação, atualização diária.",
    has_connector: true,
    tags: ["ceap", "deputados"],
  },
  {
    id: "siconfi",
    name: "SICONFI — Tesouro Nacional",
    short_description: "Dados contábeis e fiscais padronizados e comparáveis entre União, estados e municípios.",
    sphere: "nacional",
    branch: "independente",
    access: ["api", "bulk"],
    categories: ["fiscal_contabil", "receitas", "despesas"],
    requires_auth: false,
    formats: ["JSON", "CSV"],
    endpoints: [{ label: "Portal", url: "https://siconfi.tesouro.gov.br", kind: "portal" }],
    uf: null,
    notes: "Ideal para comparar finanças entre entes.",
    has_connector: true,
    tags: ["rreo", "rgf", "comparável"],
  },
  {
    id: "querido_diario",
    name: "Querido Diário",
    short_description: "Diários oficiais de milhares de municípios, com busca por palavra-chave e filtro por IBGE.",
    sphere: "municipal",
    branch: "independente",
    access: ["api"],
    categories: ["diarios_oficiais"],
    requires_auth: false,
    formats: ["JSON"],
    endpoints: [{ label: "Site", url: "https://queridodiario.ok.org.br", kind: "portal" }],
    uf: null,
    notes: "Resolve prefeituras que só publicam PDF sem estrutura.",
    has_connector: true,
    tags: ["diários", "municípios"],
  },
  {
    id: "tse",
    name: "TSE — Dados Abertos",
    short_description: "Prestação de contas eleitorais: receitas e despesas de campanha de candidatos e partidos.",
    sphere: "nacional",
    branch: "eleitoral",
    access: ["bulk", "ckan"],
    categories: ["campanhas_eleitorais", "receitas", "despesas"],
    requires_auth: false,
    formats: ["CSV", "TXT"],
    endpoints: [{ label: "Dados Abertos TSE", url: "https://dadosabertos.tse.jus.br", kind: "portal" }],
    uf: null,
    notes: "Arquivos grandes; alguns excedem o limite do Excel.",
    has_connector: false,
    tags: ["eleições", "campanha"],
  },
  {
    id: "sancoes",
    name: "Cadastros de sanções (CEIS / CNEP)",
    short_description: "Empresas impedidas de contratar e punidas pela Lei Anticorrupção — due diligence de fornecedores.",
    sphere: "nacional",
    branch: "independente",
    access: ["api", "web"],
    categories: ["sancoes", "empresas"],
    requires_auth: false,
    formats: ["JSON", "CSV"],
    endpoints: [{ label: "Consulta", url: "https://portaldatransparencia.gov.br/sancoes/consulta", kind: "portal" }],
    uf: null,
    notes: "Alimentado por todos os entes e Poderes.",
    has_connector: false,
    tags: ["ceis", "cnep", "due diligence"],
  },
  {
    id: "uf_sp",
    name: "Transparência São Paulo (SP)",
    short_description: "Portal de transparência do estado de São Paulo: despesas, servidores e licitações estaduais.",
    sphere: "estadual",
    branch: "executivo",
    access: ["scrape"],
    categories: ["despesas", "salarios", "servidores", "licitacoes", "fiscal_contabil"],
    requires_auth: false,
    formats: ["HTML", "CSV"],
    endpoints: [{ label: "Portal", url: "https://transparencia.sp.gov.br", kind: "portal" }],
    uf: "SP",
    notes: null,
    has_connector: false,
    tags: ["estado", "sp"],
  },
];

export const MOCK_STATS: Stats = {
  total_sources: 71,
  with_connector: 6,
  with_api: 11,
  requires_auth: 1,
  by_sphere: { federal: 7, nacional: 9, estadual: 27, municipal: 28 },
  by_branch: { executivo: 58, legislativo: 2, judiciario: 1, eleitoral: 1, independente: 9 },
  by_category: {
    despesas: 62,
    salarios: 56,
    servidores: 56,
    licitacoes: 55,
    fiscal_contabil: 29,
    contratos: 3,
    receitas: 29,
    sancoes: 1,
    campanhas_eleitorais: 1,
    diarios_oficiais: 2,
    empresas: 4,
  },
};

export const MOCK_CONNECTORS: ConnectorInfo[] = [
  {
    source_id: "pncp",
    label: "PNCP — Contratos",
    params: [
      { name: "data_inicial", label: "Data inicial", kind: "date", required: true, help: null, options: null },
      { name: "data_final", label: "Data final", kind: "date", required: true, help: null, options: null },
    ],
  },
  {
    source_id: "querido_diario",
    label: "Querido Diário — Diários oficiais",
    params: [
      { name: "querystring", label: "Palavra-chave", kind: "text", required: false, help: null, options: null },
      { name: "ibge", label: "Código IBGE", kind: "ibge", required: false, help: null, options: null },
    ],
  },
];

export const MOCK_RECORDS: NormalizedRecord[] = [
  {
    id: "pncp:1",
    source_id: "pncp",
    kind: "contrato",
    title: "Aquisição de equipamentos de informática para rede municipal de ensino",
    description: null,
    entity_name: "Prefeitura Municipal",
    counterparty_name: "TechSupri Comércio de Equipamentos LTDA",
    counterparty_doc: "12.345.678/0001-90",
    amount: 1284500,
    currency: "BRL",
    occurred_on: "2024-05-16",
    uf: "SP",
    municipality: "Campinas",
    source_url: "https://pncp.gov.br",
    raw: {},
  },
  {
    id: "pncp:2",
    source_id: "pncp",
    kind: "contrato",
    title: "Serviço continuado de limpeza e conservação predial",
    description: null,
    entity_name: "Secretaria de Estado da Saúde",
    counterparty_name: "Higieniza Facilities S/A",
    counterparty_doc: "98.765.432/0001-11",
    amount: 4920000,
    currency: "BRL",
    occurred_on: "2024-04-02",
    uf: "MG",
    municipality: "Belo Horizonte",
    source_url: "https://pncp.gov.br",
    raw: {},
  },
  {
    id: "pncp:3",
    source_id: "pncp",
    kind: "contrato",
    title: "Fornecimento de medicamentos básicos — ata de registro de preço",
    description: null,
    entity_name: "Ministério da Saúde",
    counterparty_name: "FarmaBrasil Distribuidora LTDA",
    counterparty_doc: "11.222.333/0001-44",
    amount: 18750000,
    currency: "BRL",
    occurred_on: "2024-03-21",
    uf: "DF",
    municipality: "Brasília",
    source_url: "https://pncp.gov.br",
    raw: {},
  },
];

export function mockSearch(query: string | null): SearchResponse {
  const q = (query ?? "").toLowerCase().trim();
  const hits = MOCK_SOURCES.map((source) => {
    let score = 1;
    if (q) {
      const hay = `${source.name} ${source.short_description} ${source.tags.join(" ")}`.toLowerCase();
      const words = q.split(/\s+/);
      const matches = words.filter((w) => hay.includes(w)).length;
      score = matches / words.length;
    }
    return { score, source };
  })
    .filter((h) => (q ? h.score > 0 : true))
    .sort((a, b) => b.score - a.score);
  return { query, embedder: "mock", total: hits.length, hits };
}
