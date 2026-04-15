# Krato-AI

Rede multi-agente de IA para desenvolvimento full-stack. Ela roda em uma VPS
modesta (Contabo 12 GB), utiliza Ollama para inferência local e escala para
modelos de fronteira na nuvem sob demanda. Agentes especializados se comportam
como um time de coworking (Product, Design, Dev, QA, DevSecOps) e criam
projetos reais na **sua máquina**, via terminal e API, através de um canal
seguro MCP-sobre-Tailscale.

```
┌────────────────────────── VPS Contabo (12 GB) ─────────────────────────┐
│  docker-compose:                                                       │
│   ├─ ollama  (llama3.1:8b-q4 / qwen2.5-coder:7b-q4 / deepseek-coder)   │
│   ├─ qdrant  (RAG isolado por projeto)                                │
│   └─ krato-ai (orquestrador, API 7070, CLI)                           │
│        │                                                               │
│        ├─ Roteador híbrido  → Ollama local  (rápido/grátis)           │
│        │                     → Cloud APIs    (Claude / GPT / Gemini)  │
│        ├─ Memória Global    (SQLite, aprende entre projetos)          │
│        ├─ Memória Isolada   (Qdrant, um collection por projeto)       │
│        └─ MCP Client  ──► Tailnet (WireGuard) ──► MCP Server (local)  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │  SUA MÁQUINA    │
                                         │  krato-mcp      │
                                         │  (allowlist +   │
                                         │   sandbox HITL) │
                                         │  ~/workspace/   │
                                         │  krato-projects │
                                         └─────────────────┘
```

## Os 5 agentes do coworking

| Agente | Arquétipo | Modelo-padrão | Responsabilidade |
|---|---|---|---|
| **Product & Architecture** | Visionário Analítico | `llama3.1:8b-instruct-q4_K_M` | Traduz intenção do humano em PRD + ADRs + stack. |
| **UX/UI & Design** | Estrategista Criativo | `llama3.1:8b-instruct-q4_K_M` + Vision (cloud quando há imagens) | Emite design tokens + spec de telas/estados. |
| **Lead Full Stack Developer** | Construtor Lógico | `qwen2.5-coder:7b-instruct-q4_K_M` | Escreve código (Next.js 15, TS strict, Tailwind). |
| **QA & Testing** | Inquisidor | `deepseek-coder-v2:lite` | Roda typecheck/tests/lint, emite relatório. Loop Evaluator-Optimizer. |
| **DevSecOps** | Guardião | `llama3.1:8b-instruct-q4_K_M` | SCA (npm audit), secrets scan, valida Docker + CI. |

Os agentes trocam artefatos via um **blackboard** (não via chat), o que mantém
a precisão do LLM estável mesmo em sessões longas.

## Memória em duas camadas

- **RAG isolado por projeto** (Qdrant): cada projeto tem um `collection` próprio.
  Chunks são gerados com sensibilidade sintática (funções, exports, blocos MD).
  Nada vaza entre projetos.
- **Memória global** (SQLite `data/krato.db`): ao fim de cada sessão, um agente
  observador destila *preferences*, *patterns*, *rules* e *lessons* do humano
  (actorId). Esses fatos são injetados como **preâmbulo** em todos os agentes
  em sessões futuras — é o *Portfólio de Contexto Pessoal*.

## Execução remota segura (MCP + Tailscale)

A VPS **não** tem acesso irrestrito à sua máquina. O caminho é:

1. Você instala o Tailscale nas duas pontas.
2. Roda `krato-mcp` (em `mcp-server/`) na sua estação, como usuário comum (não
   `root`), com um token compartilhado e um `MCP_WORKSPACE` sandboxeado.
3. A VPS fala com o MCP server via JSON-RPC HTTP usando o IP Tailscale.
4. Todo comando passa por uma **allowlist**; comandos destrutivos exigem
   aprovação humana (HITL).
5. Path traversal é bloqueado — tudo é resolvido dentro do workspace.

Veja [`src/execution/policy.ts`](src/execution/policy.ts) e
[`mcp-server/src/index.ts`](mcp-server/src/index.ts).

## Setup rápido

### 1. Na VPS Contabo

```bash
git clone https://github.com/dev-vra/krato-ai.git
cd krato-ai
cp .env.example .env
# edite .env: CLOUD_API_KEY, MCP_URL (tailscale IP da sua máquina), MCP_TOKEN

docker compose up -d ollama qdrant
./scripts/bootstrap-models.sh   # baixa os modelos sweet-spot
docker compose up -d krato-ai
```

A API sobe em `http://127.0.0.1:7070`. Exponha apenas via Tailnet em produção.

### 2. Na sua máquina local (MCP server)

```bash
cd mcp-server
npm install
npm run build
export KRATO_MCP_TOKEN="o-mesmo-token-do-.env-da-vps"
export KRATO_MCP_WORKSPACE="$HOME/workspace/krato-projects"
node dist/index.js
```

O MCP server agora ouve em `:8787` (apenas via Tailnet — use ACLs do Tailscale
para restringir à VPS específica).

### 3. Uso

**Via CLI** (na VPS ou localmente com `KRATO_*` env apontando para a VPS):

```bash
npm run build
./dist/cli.js health
./dist/cli.js run \
  --actor vra \
  --goal "SaaS de gestão de tarefas com autenticação e billing" \
  --input "Multi-tenant, free tier + planos Pro. Onboarding passo a passo." \
  --image ~/mockups/dashboard.png
```

**Via API REST**:

```bash
curl -X POST http://127.0.0.1:7070/runs \
  -H 'content-type: application/json' \
  -d '{
    "actorId": "vra",
    "goal": "Landing page com captura de lead e integração HubSpot",
    "initialInput": "Hero com vídeo, benefícios, social proof, FAQ"
  }'
```

## Modelos suportados (Ollama)

Padrão otimizado para 12 GB RAM (quantizações Q4_K_M):

- `llama3.1:8b-instruct-q4_K_M` — raciocínio geral, roteamento
- `qwen2.5-coder:7b-instruct-q4_K_M` — código
- `deepseek-coder-v2:16b-lite-instruct-q4_K_M` — avaliação independente (QA)
- `nomic-embed-text` — embeddings para o RAG
- **Alternativa PT-BR**: `capivara:7b-q4_K_M` / `mythos:7b` (configure via
  `KRATO_MODEL_ROUTER` no `.env`)

Se `CLOUD_API_KEY` estiver setada, o router escala automaticamente para a
nuvem quando:
- o prompt tem imagens (wireframes/Figma)
- a tarefa tem complexidade alta (arquitetura, refatoração global)
- o prompt passa de `CLOUD_ESCALATE_ON_TOKENS` tokens
- houve `CLOUD_ESCALATE_ON_FAILURES` falhas locais consecutivas

## Observabilidade

Logs estruturados via `pino`. Cada evento de agente é persistido em
`events` (SQLite), com `session_id` + `agent` + `payload`. Consulta rápida:

```bash
sqlite3 data/krato.db \
  "SELECT agent, kind, created_at FROM events
   WHERE session_id='<id>' ORDER BY created_at;"
```

## Estrutura

```
src/
├── agents/          # product, design, developer, qa, devsecops
├── orchestrator/    # graph (state machine) + blackboard
├── llm/             # ollama, cloud, router híbrido
├── memory/          # rag (Qdrant), global (SQLite), vector client
├── execution/       # mcp-client + policy (allowlist/HITL)
├── api/server.ts    # Fastify
└── cli.ts           # CLI commander

mcp-server/          # daemon para a máquina local do dev
scripts/             # utilitários (bootstrap-models etc.)
```

## Limitações conhecidas do MVP

- O streaming SSE do `/runs/:id/stream` está como placeholder; exige um broker
  (Redis/NATS) para produção real.
- O scan de segredos usa apenas heurística via `npm audit`; integrações com
  Gitleaks/TruffleHog ficam para um próximo ciclo.
- O scaffold inicial assume Next.js; outros templates devem virar ADRs
  selecionáveis pelo Product Agent.
- O chunker sintático do RAG usa regex; para casos complexos, trocar por um
  parser TS real (tree-sitter) é o caminho.

## Licença

MIT.
