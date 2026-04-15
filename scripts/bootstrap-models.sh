#!/usr/bin/env bash
# Baixa os modelos "sweet-spot" para a VPS de 12GB apos subir o Ollama.
# Execute APOS `docker compose up -d ollama` ter ficado pronto.
set -euo pipefail

OLLAMA="${OLLAMA_HOST:-http://127.0.0.1:11434}"

models=(
  "llama3.1:8b-instruct-q4_K_M"
  "qwen2.5-coder:7b-instruct-q4_K_M"
  "deepseek-coder-v2:16b-lite-instruct-q4_K_M"
  "nomic-embed-text"
)

for m in "${models[@]}"; do
  echo ">> baixando $m"
  curl -s "${OLLAMA}/api/pull" -d "{\"name\":\"${m}\"}" | tail -n1
done

echo ">> modelos disponiveis:"
curl -s "${OLLAMA}/api/tags" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).models.map(m=>m.name).join('\n'))}catch(e){console.log(d)}})"
