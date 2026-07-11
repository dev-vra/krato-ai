# Arquitetura do Kratos

## Princípios

1. **Catálogo como espinha dorsal.** Toda fonte do documento vira uma entrada estruturada
   (`SourceDefinition`) com metadados: ente, Poder, esfera, tipo de acesso, formato,
   autenticação, categorias de dado e endpoints. É sobre esse catálogo que a busca
   semântica e os filtros operam primeiro.
2. **Conectores plugáveis.** Cada fonte com API implementa a interface `Connector`. Fontes
   sem API entram como definições de catálogo com `access=SCRAPE`/`BULK`, prontas para um
   adaptador de scraping/ingestão.
3. **Modelo comum.** Conectores normalizam saídas heterogêneas (contratos, despesas,
   reembolsos, diários) para `NormalizedRecord`, o que permite busca e comparação
   cross-source.
4. **Semântica + filtros juntos.** A busca combina similaridade vetorial (pgvector) com
   filtros estruturados (ente, período, valor, fonte). Sem modelo de embeddings disponível,
   há fallback determinístico TF-IDF — o sistema nunca fica "sem busca".

## Fluxo de dados

```
Fontes públicas (APIs / CSV / HTML)
        │  Connector.fetch()
        ▼
NormalizedRecord  ──►  ETL/normalização  ──►  Postgres (+ pgvector embeddings)
        │                                              │
        └───────────────  API REST  ◄──────────────────┘
                              │
                              ▼
                    Frontend (React) — dashboards, busca, painéis, modais
```

## Backend (`backend/app`)

| Módulo | Responsabilidade |
|--------|------------------|
| `catalog/` | `SourceDefinition`, registro central, fontes federais + subnacionais |
| `connectors/` | `base.Connector`, `registry`, conectores por fonte (PNCP, Câmara, …) |
| `search/` | embeddings, índice vetorial, ranqueamento semântico + filtros |
| `etl/` | ingestão, deduplicação, normalização |
| `models/` | schemas Pydantic + ORM SQLAlchemy |
| `api/` | rotas REST (`/sources`, `/search`, `/kpis`, `/connectors`) |

## Conectores implementados

Prontos e reais (APIs públicas sem autenticação):

- **PNCP** — contratos e licitações de todos os entes.
- **Câmara dos Deputados** — despesas CEAP por deputado.
- **Querido Diário** — busca em diários oficiais municipais.
- **SICONFI** — dados fiscais comparáveis (RREO/RGF).
- **dados.gov.br (CKAN)** — descoberta de datasets.
- **Portal da Transparência** — implementado com injeção de token (config).

## Frontend (`frontend/src`)

Design system Kratos: layout edge-to-edge, uma barra superior com busca global (command
palette), painéis laterais deslizantes (esquerda: navegação/fontes; direita: filtros e
detalhes), modais para documentos, glass blur (`backdrop-blur`), tema light, framer-motion
para transições e **skeletons/loadings animados** em toda carga de dados.
