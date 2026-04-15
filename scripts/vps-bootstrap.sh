#!/usr/bin/env bash
# vps-bootstrap.sh — roda UMA vez na VPS Contabo antes do primeiro deploy.
#
# O que faz:
#   1. Atualiza o sistema
#   2. Instala Docker (repo oficial)
#   3. Instala Tailscale (voce loga manualmente no final)
#   4. Cria usuario 'krato' (nao-root) para rodar o stack
#   5. Clona o repositorio em ~/krato-ai
#   6. Gera .env com MCP_TOKEN aleatorio
#   7. Pre-cria volumes e diretorio de dados
#   8. Imprime checklist de secrets do GitHub
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/dev-vra/krato-ai/main/scripts/vps-bootstrap.sh | bash
# Ou, se ja clonou:
#   bash scripts/vps-bootstrap.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/dev-vra/krato-ai.git}"
REPO_DIR="${REPO_DIR:-$HOME/krato-ai}"
BRANCH="${BRANCH:-claude/ai-system-generator-ollama-OU6SP}"

log() { printf "\n\033[1;36m>> %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m!! %s\033[0m\n" "$*"; }

if [ "$(id -u)" -eq 0 ]; then
  warn "Voce esta como root. Recomendado criar um usuario dedicado."
  warn "Continuando mesmo assim (10s pra cancelar com Ctrl-C)..."
  sleep 10
fi

# -------- 1) atualizar sistema --------
log "atualizando pacotes base"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  curl ca-certificates gnupg lsb-release git jq ufw

# -------- 2) Docker --------
if ! command -v docker >/dev/null 2>&1; then
  log "instalando Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  warn "voce precisa deslogar/relogar (ou 'newgrp docker') para usar docker sem sudo"
else
  log "docker ja instalado: $(docker --version)"
fi

# -------- 3) Tailscale --------
if ! command -v tailscale >/dev/null 2>&1; then
  log "instalando Tailscale"
  curl -fsSL https://tailscale.com/install.sh | sh
  warn "rode agora:  sudo tailscale up --ssh --advertise-tags=tag:krato-vps"
  warn "             e anote o IP 100.x.y.z exibido"
else
  log "tailscale ja instalado: $(tailscale version | head -1)"
fi

# -------- 4) firewall minimo --------
log "configurando firewall (UFW) — so SSH aberto publicamente"
sudo ufw --force reset >/dev/null
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
# 7070 (API) e 11434 (Ollama) so via Tailscale/loopback
sudo ufw --force enable

# -------- 5) clone do repo --------
if [ ! -d "$REPO_DIR/.git" ]; then
  log "clonando $REPO_URL em $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi
cd "$REPO_DIR"
git fetch --all --prune
git checkout "$BRANCH"

# -------- 6) .env --------
if [ ! -f .env ]; then
  log "gerando .env com MCP_TOKEN aleatorio"
  cp .env.example .env
  NEW_TOKEN=$(openssl rand -hex 32)
  sed -i "s|^MCP_TOKEN=.*|MCP_TOKEN=${NEW_TOKEN}|" .env
  warn "guarde este MCP_TOKEN — voce precisa do mesmo valor na sua maquina local:"
  echo "    $NEW_TOKEN"
else
  log ".env ja existe, preservando"
fi

# -------- 7) diretorios --------
log "criando diretorios de dados"
mkdir -p "$REPO_DIR/data"

# -------- 8) checklist GitHub Actions --------
cat <<EOF

============================================================
  BOOTSTRAP COMPLETO
============================================================

Proximos passos:

1) Se o 'sudo usermod -aG docker \$USER' rodou agora, desloga e
   reloga da VPS (ou 'exec sg docker -c bash') antes de continuar.

2) Ative o Tailscale (se ainda nao fez):
     sudo tailscale up --ssh --advertise-tags=tag:krato-vps

3) Ajuste o .env com pelo menos:
     - CLOUD_API_KEY (opcional, pra escalar pra nuvem)
     - MCP_URL (IP Tailscale da sua maquina local, porta 8787)
     nano $REPO_DIR/.env

4) Gere uma chave SSH dedicada para o GitHub Actions (na SUA maquina):
     ssh-keygen -t ed25519 -f ~/.ssh/krato_deploy -N "" -C krato-deploy
     ssh-copy-id -i ~/.ssh/krato_deploy.pub $USER@<VPS_IP>

5) No GitHub (Settings -> Secrets and variables -> Actions), adicione:
     VPS_HOST       = IP publico ou hostname da VPS
     VPS_USER       = $USER
     VPS_SSH_KEY    = conteudo de ~/.ssh/krato_deploy (privada, chave completa)
     VPS_PORT       = 22  (opcional)

6) Faca o primeiro deploy:
     - via push na branch configurada, OU
     - Actions -> 'Deploy to Contabo VPS' -> Run workflow
     - na primeira vez, DESMARQUE 'skip_models' para baixar os modelos

7) Acompanhe ao vivo (em uma sessao SSH paralela):
     docker compose -f $REPO_DIR/docker-compose.yml logs -f --tail 100

============================================================
EOF
