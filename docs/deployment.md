# Deployment Guide — VPS Contabo + Máquina Local

Guia passo a passo para rodar o Krato-AI em produção (pessoal).

## 1. Preparar a VPS (Ubuntu 22.04/24.04)

```bash
# 1.1 atualizar
sudo apt update && sudo apt -y upgrade

# 1.2 instalar Docker (script oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 1.3 instalar Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
# anote o IP 100.x.x.x dessa VPS
```

## 2. Instalar o Krato-AI na VPS

```bash
git clone https://github.com/dev-vra/krato-ai.git
cd krato-ai
cp .env.example .env
```

Edite `.env`:

```ini
# Aponta para o IP Tailscale da SUA MÁQUINA LOCAL (não da VPS)
MCP_URL=http://100.xx.yy.zz:8787
MCP_TOKEN=$(openssl rand -hex 32)   # copie este valor para a máquina local

# Opcional mas recomendado
CLOUD_PROVIDER=anthropic
CLOUD_API_KEY=sk-ant-...
CLOUD_MODEL=claude-sonnet-4-6
```

Suba a stack:

```bash
docker compose up -d ollama qdrant
./scripts/bootstrap-models.sh     # baixa 4 modelos (pode levar 20-40min)
docker compose up -d krato-ai
docker compose logs -f krato-ai
```

Verifique:

```bash
curl http://127.0.0.1:7070/health
```

## 3. Preparar a máquina local

```bash
# 3.1 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# anote seu IP 100.x.x.x

# 3.2 clonar e compilar o MCP server
git clone https://github.com/dev-vra/krato-ai.git
cd krato-ai/mcp-server
npm install
npm run build

# 3.3 rodar como usuário comum
export KRATO_MCP_TOKEN="<o MESMO token do .env da VPS>"
export KRATO_MCP_WORKSPACE="$HOME/workspace/krato-projects"
export KRATO_MCP_PORT=8787

node dist/index.js
# [krato-mcp] ouvindo em http://0.0.0.0:8787
```

Para rodar em background use `systemd --user` ou `pm2`.

## 4. Restrição de acesso via Tailscale ACLs

No admin do Tailscale (`https://login.tailscale.com/admin/acls`), cole:

```jsonc
{
  "tagOwners": {
    "tag:krato-vps": ["you@example.com"],
    "tag:krato-dev": ["you@example.com"]
  },
  "acls": [
    // Apenas a VPS tagueada pode falar com a estação local na porta 8787.
    { "action": "accept", "src": ["tag:krato-vps"], "dst": ["tag:krato-dev:8787"] }
  ]
}
```

Aplique as tags:

```bash
# Na VPS
sudo tailscale up --advertise-tags=tag:krato-vps
# Na máquina local
sudo tailscale up --advertise-tags=tag:krato-dev
```

## 5. Primeiro teste ponta-a-ponta

Na VPS (SSH):

```bash
docker compose exec krato-ai node dist/cli.js health
# { ollama: {...}, qdrant: true, mcp: true, cloud: {...} }

docker compose exec krato-ai node dist/cli.js run \
  --actor vra \
  --goal "CRUD simples de tarefas em Next.js 15 com SQLite e autenticação"
```

Você verá o fluxo: `product -> design -> developer -> qa -> devsecops`.
Os arquivos são criados em `~/workspace/krato-projects/proj-xxxxx/` na sua
**máquina local**.

## 6. Operação

### Logs

```bash
docker compose logs -f krato-ai ollama
```

### Memória global

```bash
# via CLI
docker compose exec krato-ai node dist/cli.js memory:list --actor vra

# via API
curl 'http://127.0.0.1:7070/memory/global?actorId=vra'

# adicionar manualmente
curl -X POST http://127.0.0.1:7070/memory/global \
  -H 'content-type: application/json' \
  -d '{"actorId":"vra","kind":"rule","text":"Sempre usar pnpm, nunca npm","confidence":0.95}'
```

### Backups

- `ollama-data/` : ~20 GB (modelos) — reinstalável via script.
- `qdrant-data/` : RAG por projeto — **backup recomendado**.
- `krato-data/krato.db` : memória global e eventos — **backup crítico**.

```bash
sudo tar czf krato-backup-$(date +%F).tgz \
  /var/lib/docker/volumes/krato-ai_qdrant-data \
  /var/lib/docker/volumes/krato-ai_krato-data
```

## 7. Troubleshooting

| Sintoma | Provável causa | Ação |
|---|---|---|
| `ollama ping failed` | daemon não subiu ou RAM esgotou | `docker compose logs ollama` |
| `MCP ... HTTP 401` | token diferente entre VPS e local | sincronize `MCP_TOKEN` / `KRATO_MCP_TOKEN` |
| Agente Dev repete falhas | modelo local travando no contexto | suba `CLOUD_ESCALATE_ON_FAILURES=1` |
| Swap alto durante inferência | modelo maior que RAM disponível | troque para variante Q4 menor |
| `policy: comando negado` | comando fora da allowlist | edite `src/execution/policy.ts` consciente |
