#!/usr/bin/env bash
# vps-deploy.sh — executado pelo GitHub Actions (ou manualmente).
#
# Idempotente: seguro rodar quantas vezes quiser. Faz:
#   1. Sanity check do .env
#   2. docker compose pull (imagens externas)
#   3. docker compose build krato-ai (codigo local)
#   4. Sobe ollama + qdrant primeiro, espera ficar saudavel
#   5. Baixa modelos Ollama se SKIP_MODELS != true e algum faltando
#   6. Sobe krato-ai
#   7. Aguarda /health responder 200
#   8. Imprime resumo (versao, containers, uso de memoria)
#
# Vars de ambiente:
#   SKIP_MODELS=true     (default) — nao tenta pull de modelos
#   FORCE_RECREATE=true  — passa --force-recreate ao compose
#   COMPOSE_FILE         — override (default: docker-compose.yml do repo)

set -euo pipefail

SKIP_MODELS="${SKIP_MODELS:-true}"
FORCE_RECREATE="${FORCE_RECREATE:-false}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

log()  { printf "\n\033[1;36m>> %s\033[0m\n" "$*"; }
fail() { printf "\n\033[1;31mxx %s\033[0m\n" "$*"; exit 1; }

# -------- sanity --------
[ -f "$COMPOSE_FILE" ] || fail "nao achei $COMPOSE_FILE (rodou do diretorio certo?)"
[ -f .env ]            || fail "nao achei .env — rode vps-bootstrap.sh primeiro"

if ! grep -q "^MCP_TOKEN=[a-zA-Z0-9_-]\{16,\}" .env; then
  fail "MCP_TOKEN vazio ou muito curto no .env"
fi

RECREATE_FLAG=""
[ "$FORCE_RECREATE" = "true" ] && RECREATE_FLAG="--force-recreate"

# -------- build + pull --------
log "docker compose pull (imagens externas)"
docker compose pull ollama qdrant

log "docker compose build krato-ai (codigo da branch atual)"
docker compose build krato-ai

# -------- infra (ollama + qdrant) --------
log "subindo ollama e qdrant"
docker compose up -d $RECREATE_FLAG ollama qdrant

log "aguardando ollama responder (max 90s)"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo "ollama OK"; break
  fi
  [ "$i" -eq 30 ] && fail "ollama nao subiu"
  sleep 3
done

log "aguardando qdrant responder (max 30s)"
for i in $(seq 1 10); do
  if curl -fsS http://127.0.0.1:6333/ >/dev/null 2>&1; then
    echo "qdrant OK"; break
  fi
  [ "$i" -eq 10 ] && fail "qdrant nao subiu"
  sleep 3
done

# -------- modelos (opcional, pesado) --------
if [ "$SKIP_MODELS" != "true" ]; then
  log "verificando modelos Ollama"
  WANT=(
    "llama3.1:8b-instruct-q4_K_M"
    "qwen2.5-coder:7b-instruct-q4_K_M"
    "deepseek-coder-v2:16b-lite-instruct-q4_K_M"
    "nomic-embed-text"
  )
  HAVE=$(curl -fsS http://127.0.0.1:11434/api/tags | jq -r '.models[].name' || true)
  for m in "${WANT[@]}"; do
    if echo "$HAVE" | grep -Fxq "$m"; then
      echo "  [ok] $m"
    else
      log "baixando $m (isso pode levar varios minutos)"
      curl -sN http://127.0.0.1:11434/api/pull \
        -d "{\"name\":\"$m\"}" | tail -n 3 || warn "falha ao baixar $m"
    fi
  done
else
  log "SKIP_MODELS=true — pulando download (use 'Run workflow' e desmarque pra baixar)"
fi

# -------- app --------
log "subindo krato-ai"
docker compose up -d $RECREATE_FLAG krato-ai

log "aguardando /health (max 60s)"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:7070/health >/dev/null 2>&1; then
    echo "krato-ai OK"; break
  fi
  [ "$i" -eq 20 ] && fail "krato-ai nao respondeu — veja 'docker compose logs krato-ai'"
  sleep 3
done

# -------- resumo --------
log "containers:"
docker compose ps
log "uso de memoria:"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}"
log "health check final:"
curl -fsS http://127.0.0.1:7070/health | jq . || curl -fsS http://127.0.0.1:7070/health

echo ""
echo "deploy concluido."
