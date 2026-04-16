# 🚀 Guia Completo de Deploy no VPS Contabo

## Pré-requisitos da VPS

- **SO**: Ubuntu 22.04 ou 24.04
- **RAM**: Mínimo 12GB (recomendado 16GB+)
- **CPU**: 4+ cores
- **Storage**: 50GB+ SSD
- **Rede**: Porta 80/443 abertas para webhook Telegram

---

## 📋 PASSO 1: Configurar VPS

### 1.1 Atualizar sistema e instalar Docker
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

### 1.2 Instalar Tailscale (para conectar com MCP local)
```bash
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up
# Anote o IP da Tailscale (ex: 100.x.y.z)
```

### 1.3 Configurar firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp    # Webhook Telegram
sudo ufw allow 443/tcp   # HTTPS (opcional)
sudo ufw allow 7070/tcp  # API Krato-AI
sudo ufw enable
```

---

## 🤖 PASSO 2: Criar Bot do Telegram

### 2.1 No Telegram, converse com @BotFather
```
/newbot
Nome: Krato AI Assistant
Username: krato_ai_bot (deve terminar em _bot)
```

### 2.2 Copie o TOKEN retornado
Exemplo: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 2.3 Obter seu ADMIN_ID
1. Inicie uma conversa com seu bot
2. Envie qualquer mensagem
3. Acesse: `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates`
4. Copie o `"id"` do campo `"from"` (ex: 987654321)

---

## ⚙️ PASSO 3: Configurar .env

```bash
cd ~/krato-ai
cp .env.example .env
nano .env
```

### Conteúdo mínimo do .env:
```ini
# Servidor
PORT=7070
HOST=0.0.0.0
LOG_LEVEL=info

# Ollama (local via Docker)
OLLAMA_HOST=http://ollama:11434
OLLAMA_KEEP_ALIVE=-1
OLLAMA_NUM_THREAD=4

# Modelos
KRATO_MODEL_ROUTER=llama3.1:8b-instruct-q4_K_M
KRATO_MODEL_CODER=qwen2.5-coder:7b-instruct-q4_K_M
KRATO_MODEL_EVAL=deepseek-coder-v2:lite-q4_K_M
KRATO_MODEL_EMBED=nomic-embed-text

# Qdrant
QDRANT_URL=http://qdrant:6333

# Cloud (opcional - para Claude/GPT)
CLOUD_PROVIDER=none
# CLOUD_PROVIDER=anthropic
# CLOUD_API_KEY=sk-ant-xxx

# MCP (conexão com sua máquina local via Tailscale)
MCP_URL=ws://100.x.y.z:8787
MCP_TOKEN=mesmo_token_local
MCP_WORKSPACE=/root/workspace/krato-projects
MCP_REQUIRE_APPROVAL=false

# Telegram (CRÍTICO)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_ID=987654321

# Dados
KRATO_DATA_DIR=/root/krato-ai/data
KRATO_DB_PATH=/root/krato-ai/data/krato.db
```

---

## 🐳 PASSO 4: Deploy com Docker

### 4.1 Clonar repositório
```bash
git clone https://github.com/dev-vra/krato-ai.git ~/krato-ai
cd ~/krato-ai
```

### 4.2 Subir serviços base
```bash
docker compose up -d ollama qdrant
```

### 4.3 Baixar modelos (~20GB)
```bash
chmod +x scripts/bootstrap-models.sh
./scripts/bootstrap-models.sh
# Aguarde ~10-15 minutos
```

### 4.4 Subir Krato-AI
```bash
docker compose up -d krato-ai
```

### 4.5 (Opcional) Monitoramento
```bash
docker compose -f docker-compose.monitoring.yml up -d
```

---

## 🔗 PASSO 5: Configurar Webhook Telegram

### 5.1 Na VPS, verifique se está rodando
```bash
docker logs krato-ai --tail 50
# Deve aparecer: "Server listening on 0.0.0.0:7070"
```

### 5.2 Configurar webhook
```bash
# Substitua SEU_DOMínio ou IP público da VPS
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook?url=https://<SEU_IP_OU_DOMINIO>:7070/api/telegram/webhook"
```

### 5.3 Verificar status
```bash
curl "https://api.telegram.org/bot<SEU_TOKEN>/getWebhookInfo"
```

---

## 🧪 PASSO 6: Testar

### 6.1 No Telegram
```
/start
/help
/tasks listar
/expenses adicionar 50 Almoço
/ask como criar um servidor HTTP em Node.js?
```

### 6.2 Enviar comando de projeto
```
/project meu-app deploy production
```

### 6.3 Ver logs
```bash
docker logs krato-ai -f
```

---

## 🔄 Configurar MCP na Máquina Local

Na sua máquina de desenvolvimento:

```bash
cd ~/krato-ai
npm run mcp-server
```

No `.env.local`:
```ini
MCP_TOKEN=mesmo_token_da_vps
```

A VPS conectará automaticamente via Tailscale.

---

## 🛡️ Segurança

### ACLs no Tailscale
```bash
# No admin console do Tailscale (https://login.tailscale.com/admin/acls)
{
  "acls": [
    { "action": "accept", "src": ["tag:server"], "dst": ["tag:local:*"] }
  ]
}
```

### Backup automático
```bash
# Adiciona ao crontab
0 3 * * * /root/krato-ai/scripts/backup.sh
```

---

## 📊 Comandos Úteis

```bash
# Ver status
docker compose ps

# Logs em tempo real
docker compose logs -f krato-ai

# Reiniciar serviço
docker compose restart krato-ai

# Parar tudo
docker compose down

# Limpar espaço
docker system prune -af
```

---

## 🐛 Troubleshooting

### Bot não responde
1. Verifique webhook: `getWebhookInfo`
2. Confira TOKEN e ADMIN_ID no .env
3. Veja logs: `docker logs krato-ai | grep telegram`

### Erro de memória
```bash
# Ajuste limites no docker-compose.yml
deploy:
  resources:
    limits:
      memory: 8G
```

### Modelos não carregam
```bash
docker exec -it ollama ollama list
docker compose restart ollama
```

---

## ✅ Checklist Final

- [ ] Docker instalado
- [ ] Tailscale conectado
- [ ] .env configurado com TOKEN e ADMIN_ID
- [ ] Serviços Docker rodando
- [ ] Modelos baixados
- [ ] Webhook Telegram registrado
- [ ] Testes no Telegram funcionando
- [ ] MCP local conectado (opcional)

**Pronto! Seu Krato-AI está operacional no VPS!** 🎉
