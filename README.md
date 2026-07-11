# Kratos

**Plataforma de inteligência sobre dados abertos do setor público brasileiro.**

Kratos vincula, analisa e facilita o entendimento e a busca — por semântica e filtros —
de gastos, salários, cartões corporativos, licitações, empresas, campanhas e servidores
públicos, nas três esferas de governo (federal, estadual, municipal) e nos três Poderes.

> O mapa de fontes que embasa a plataforma está descrito em
> [`docs/fontes-de-dados.md`](docs/fontes-de-dados.md) e é a espinha dorsal do catálogo.

---

## Visão

- **Uma tela, de fora a fora.** Interface focada em desktop/laptop, edge-to-edge, com uma
  única barra superior de navegação + busca textual global. Painéis laterais deslizam para
  filtros e detalhes; modais abrem documentos e especificações. Glass blur, tema light.
- **Busca por semântica + filtros.** Encontre datasets e registros por significado
  (embeddings/pgvector), não só por palavra-chave, combinando com filtros estruturados
  (ente, Poder, período, fonte, valor).
- **Conectores reais.** Um framework de conectores integra as fontes públicas — via API
  (PNCP, Câmara, Querido Diário, SICONFI, dados.gov.br/CKAN, Portal da Transparência) ou
  via ingestão em lote — normalizando tudo para um modelo comum.

## Arquitetura

```
kratos/
├── backend/          FastAPI · Python (engenharia de dados, ETL, conectores, busca)
│   └── app/
│       ├── catalog/      Registro central de fontes (o "mapa" do documento)
│       ├── connectors/   Framework + conectores por fonte
│       ├── search/       Embeddings + busca semântica (pgvector) + filtros
│       ├── etl/          Ingestão/normalização
│       ├── api/          Rotas REST
│       └── models/       Schemas Pydantic + ORM
├── frontend/         React + Vite + TypeScript + Tailwind (design system Kratos)
├── infra/            docker-compose (Postgres + pgvector)
└── docs/             Arquitetura e mapa de fontes
```

### Stack

| Camada        | Tecnologia |
|---------------|------------|
| Backend       | Python 3.11, FastAPI, httpx (async), Pydantic v2, SQLAlchemy |
| Banco         | PostgreSQL 16 + `pgvector` |
| Busca         | Embeddings (sentence-transformers, com fallback TF-IDF offline) + busca vetorial |
| Frontend      | React 18, Vite, TypeScript, TailwindCSS, framer-motion, Recharts, lucide-react |
| Infra         | Docker Compose |

## Como rodar

### 1. Banco de dados

```bash
cd infra
docker compose up -d        # Postgres + pgvector na porta 5432
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
# Docs interativas: http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

O frontend consome o backend em `http://localhost:8000` (configurável em `VITE_API_URL`).
Sem backend disponível, a UI cai para dados mock — assim é possível ver a experiência
completa mesmo antes de subir a stack de dados.

## Fontes de dados integradas

Categorias cobertas pelo catálogo (ver `backend/app/catalog/sources.py`):

- **Federal / Executivo** — Portal da Transparência (CGU), SIAFI/SIOP (via consolidadores)
- **Contratações** — PNCP, ComprasNet, CEIS/CNEP/CEPIM/CEAF, CNPJ (Receita)
- **Legislativo** — Câmara dos Deputados (CEAP), Senado (CEAPS)
- **Judiciário / Eleições** — CNJ/DataJud, TSE (financiamento de campanha)
- **Estados** — 26 estados + DF (portais de transparência)
- **Capitais** — 27 capitais (portais municipais)
- **Consolidadores** — SICONFI, dados.gov.br, Mapa Brasil Transparente
- **Bases para escala** — Querido Diário, Base dos Dados, Serenata de Amor

## Status

Fundação da plataforma. Conectores das APIs públicas sem autenticação já implementados;
fontes que exigem token (Portal da Transparência) ou scraping (portais estaduais/municipais)
entram como definições no catálogo com adaptadores prontos para configuração.
