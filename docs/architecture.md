# Arquitetura — Krato-AI

Este documento registra as decisões arquiteturais principais em formato
conciso (inspirado em ADRs). Para o README voltado ao usuário, veja
`../README.md`.

## ADR-001: Topologia multi-agente com blackboard

**Contexto.** Um único LLM encarregado de projetar + codar + testar sofre
regressão de qualidade quando a janela de contexto cresce. Grandes times
humanos resolvem isso com especialização.

**Decisão.** 5 agentes com perfis cognitivos distintos, conectados por um
**grafo de estados** (`src/orchestrator/graph.ts`). Artefatos são publicados
em um **blackboard** (`src/orchestrator/blackboard.ts`); nunca há chat
multi-turno entre agentes. Isto mantém cada invocação curta e determinística.

**Consequências.** Precisamos garantir *contratos* entre os agentes (JSON
estruturado). A latência do pipeline aumenta (múltiplas chamadas), mas a
qualidade sobe porque cada passo é independente.

## ADR-002: Roteador híbrido Ollama + nuvem

**Contexto.** 12 GB de RAM não acomodam modelos grandes; tarefas como
"traduzir mockup Figma em JSX complexo" exigem raciocínio de fronteira.

**Decisão.** `HybridRouter` (`src/llm/router.ts`) decide por heurísticas:
  - prompts multimodais → nuvem
  - `complexity: "high"` → nuvem
  - > `CLOUD_ESCALATE_ON_TOKENS` → nuvem
  - falhas locais consecutivas → fallback nuvem
  - embeddings → sempre local

**Consequências.** Economia máxima no caminho feliz; capacidade de última
milha quando necessário. Opera mesmo sem `CLOUD_API_KEY` (modo puramente
local).

## ADR-003: Memória em duas camadas (RAG + Global)

**Contexto.** "O agente esquece entre sessões" é a falha UX #1 de produtos
agênticos. RAG resolve "o que o repositório diz" mas não "o que o humano
prefere".

**Decisão.**
- **RAG isolado por projeto** (Qdrant, uma collection por `projectId`).
  Chunker sensível à sintaxe (funções/exports/cabeçalhos MD).
- **Memória global** (SQLite). Ao fim de cada sessão, um destilador extrai
  fatos semânticos (`preference|pattern|rule|lesson`) com `actorId`.
  O `buildPreamble(actorId)` injeta esses fatos no system prompt de todo
  agente, em qualquer projeto futuro.

**Consequências.** O comportamento do sistema se amolda ao humano com o
tempo. Há risco de *drift* (fatos ruins se acumulam) — mitigação: auditoria
via `/memory/global` (GET) e `confidence` score.

## ADR-004: Execução remota via MCP-sobre-Tailscale

**Contexto.** A rede agente vive na VPS; os projetos devem nascer na máquina
do desenvolvedor. Expor a estação ao Internet = suicídio.

**Decisão.** JSON-RPC mínimo (`krato-mcp`) rodando como usuário comum na
máquina local, acessível **somente** via Tailnet (WireGuard peer-to-peer).
Allowlist de comandos com 3 níveis (`allow` / `approval` / `deny`), path
traversal bloqueado, timeout de 5 min por comando.

**Consequências.** Setup exige Tailscale nas duas pontas, mas é operável por
qualquer desenvolvedor sem firewall/NAT issues. O MCP server é pequeno o
bastante para ser auditado em 10 minutos.

## ADR-005: Loop Evaluator-Optimizer entre Dev e QA

**Contexto.** LLMs têm viés de confirmação: geradores e avaliadores no mesmo
modelo convergem para respostas tautológicas.

**Decisão.** `qa.ts` usa um modelo **diferente** do `developer.ts`
(`deepseek-coder-v2` vs `qwen2.5-coder`). Relatórios do QA que detectam
falhas reabrem o grafo em `developer`, não em `done`. Iterações limitadas
por `maxIterations` para evitar loops infinitos.

**Consequências.** Código efetivamente compila/testa antes de passar para
o DevSecOps. Custo: mais tokens gastos por execução.

## ADR-006: TypeScript strict + feature-based organization

**Contexto.** Modelos de linguagem alucinam assinaturas de funções e
organização de imports quando a tipagem não guia.

**Decisão.** `tsconfig` com `strict: true`, `noUncheckedIndexedAccess`. O
system prompt do Developer exige:
- código organizado por feature (`src/features/<dominio>`),
- `named exports` (nunca `export default`),
- single quotes + trailing comma,
- estado global via Zustand, assíncrono via TanStack Query.

**Consequências.** Saídas do Developer são mais consistentes; o QA detecta
regressões via `tsc --noEmit` como parte da suite.

## ADR-007: Dockerização e limites de memória por container

**Contexto.** VPS 12 GB não comporta múltiplos modelos carregados
simultaneamente.

**Decisão.** Um container por responsabilidade com `deploy.resources.limits`:
- `ollama`: 8 GB (um modelo 8B Q4 por vez)
- `qdrant`: 1 GB
- `krato-ai`: 512 MB
- Folga: ~2.5 GB para kernel/logs

`OLLAMA_KEEP_ALIVE=-1` mantém o modelo ativo entre chamadas consecutivas dos
agentes, eliminando o custo de recarregar do NVMe.

**Consequências.** Trocar de modelo custa ~5-15s (carga do NVMe). Para
workloads com múltiplos modelos ativos, precisaríamos de RAM extra ou de
consolidar funções em um único modelo.
