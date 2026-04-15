# Deploy via GitHub Actions + SSH assistido

Esta e a rota recomendada: o GitHub Actions executa o deploy de forma
auditada e reproduzivel; voce acompanha os logs em tempo real por SSH.

## Visao geral

```
  git push / "Run workflow"
        │
        ▼
  GitHub Actions  ──ssh──►  VPS Contabo
                               │
                               ├─ git fetch + checkout <sha>
                               ├─ scripts/vps-deploy.sh
                               └─ curl /health
                               
  Voce, em paralelo: ssh VPS + docker compose logs -f
```

Nenhum comando sensivel trafega pelo chat. O deploy e acionado por
`push` na branch ou `workflow_dispatch` manual. Tudo fica auditado na
aba Actions do GitHub.

---

## Passo 1 — Primeira conexao SSH e bootstrap da VPS

Conecte-se a VPS pela primeira vez com a credencial que a Contabo enviou:

```bash
ssh root@<IP_PUBLICO_DA_VPS>
```

Crie um usuario normal (nao rode tudo como root):

```bash
adduser krato
usermod -aG sudo krato
# copie sua chave SSH para o novo usuario
rsync --archive --chown=krato:krato ~/.ssh /home/krato
exit
```

Reconecte como `krato`:

```bash
ssh krato@<IP_PUBLICO_DA_VPS>
```

Rode o bootstrap (instala Docker + Tailscale + clona repo + gera `.env`):

```bash
curl -fsSL https://raw.githubusercontent.com/dev-vra/krato-ai/claude/ai-system-generator-ollama-OU6SP/scripts/vps-bootstrap.sh \
  | bash
```

Ao final, **copie o `MCP_TOKEN`** impresso — voce vai usar na sua maquina
local. Deslogue e relogue (ou `newgrp docker`) para ativar o grupo docker.

Ative o Tailscale:

```bash
sudo tailscale up --ssh --advertise-tags=tag:krato-vps
# abra a URL exibida para autorizar, anote o IP 100.x.y.z
```

Edite o `.env` com seus valores:

```bash
nano ~/krato-ai/.env
# preencha:
#   CLOUD_API_KEY=sk-ant-...          (opcional, habilita nuvem)
#   MCP_URL=http://<TAILSCALE_DA_SUA_MAQUINA_LOCAL>:8787
```

---

## Passo 2 — Chave SSH dedicada para o Actions

Na **sua maquina local** (nao na VPS):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/krato_deploy -N "" -C krato-deploy
ssh-copy-id -i ~/.ssh/krato_deploy.pub krato@<IP_PUBLICO_DA_VPS>

# teste
ssh -i ~/.ssh/krato_deploy krato@<IP_PUBLICO_DA_VPS> 'echo ok'
```

---

## Passo 3 — Secrets no GitHub

No repositorio `dev-vra/krato-ai` abra
**Settings → Secrets and variables → Actions → New repository secret** e
adicione:

| Nome           | Valor |
|----------------|-------|
| `VPS_HOST`     | IP publico ou hostname da VPS |
| `VPS_USER`     | `krato` |
| `VPS_SSH_KEY`  | Conteudo **completo** de `~/.ssh/krato_deploy` (incluindo `-----BEGIN ... END-----`) |
| `VPS_PORT`     | `22` (opcional) |

> Dica: `cat ~/.ssh/krato_deploy | pbcopy` (macOS) ou `xclip -sel clip <
> ~/.ssh/krato_deploy` (Linux) evita erro de copia.

---

## Passo 4 — Primeiro deploy

Abra duas janelas:

**Janela A (SSH na VPS, acompanhando logs):**

```bash
ssh krato@<IP_PUBLICO_DA_VPS>
cd ~/krato-ai
docker compose logs -f --tail 0 krato-ai ollama qdrant
```

**Janela B (GitHub):**

1. Va em **Actions → Deploy to Contabo VPS → Run workflow**.
2. Na primeira execucao, **desmarque** `skip_models` (vai baixar ~20GB de
   modelos — dura 20-40 min).
3. Clique em **Run workflow**.
4. Abra o job em andamento e deixe os logs rolando lado a lado com a
   janela A.

Enquanto o workflow roda, voce ve:
- na janela B (Actions): `git fetch`, `docker build`, `curl /health`
- na janela A (SSH): pull dos modelos via API do Ollama e os containers
  subindo

Ao terminar voce devera ver no final do job:

```
krato-ai OK
{
  "ok": true,
  "ollama": true,
  "qdrant": true,
  "mcp": null,
  "cloud": true
}
```

---

## Passo 5 — Deploys subsequentes

A partir daqui, qualquer `git push` para `main` (ou a branch configurada
em `.github/workflows/deploy.yml`) dispara um deploy automatico com
`SKIP_MODELS=true` (rapido, ~30s).

Para um deploy "limpo" (recriar containers) use o `workflow_dispatch` e
marque `force_recreate`.

---

## Passo 6 — MCP server na sua maquina local

Independente do deploy na VPS, na sua estacao:

```bash
git clone https://github.com/dev-vra/krato-ai.git
cd krato-ai/mcp-server
npm install && npm run build

export KRATO_MCP_TOKEN="<mesmo token do .env da VPS>"
export KRATO_MCP_WORKSPACE="$HOME/workspace/krato-projects"
node dist/index.js
```

Deixe rodando em `tmux`/`systemd --user`. Valide a conectividade:

```bash
# na VPS
curl -fsS http://<TAILSCALE_DA_SUA_MAQUINA>:8787/rpc \
  -H "authorization: Bearer $(grep MCP_TOKEN ~/krato-ai/.env | cut -d= -f2)" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
# -> {"jsonrpc":"2.0","id":1,"result":{"ok":true,"workspace":"...","host":"..."}}
```

---

## Troubleshooting rapido

| Onde | Sintoma | Acao |
|------|---------|------|
| Actions | `Secrets faltando` | re-verifique os 3-4 secrets no passo 3 |
| Actions | `Permission denied (publickey)` | chave errada em `VPS_SSH_KEY` (tem que ser a **privada**, texto completo) |
| Actions | `VPS nao inicializada` | voce pulou o bootstrap — rode `vps-bootstrap.sh` |
| Actions | timeout no `/health` | veja `docker compose logs krato-ai` na janela A |
| SSH | `ollama` OOM | VPS sem RAM — so UM modelo 8B por vez, veja `OLLAMA_KEEP_ALIVE` |
| SSH | `MCP ... HTTP 401` | token diferente entre `.env` da VPS e `KRATO_MCP_TOKEN` local |

---

## Rollback

Actions mantem historico. Para voltar a um commit anterior:

1. Actions → selecione o run que estava OK.
2. Copie o SHA da coluna "Commit".
3. Na aba Code, `git reset --hard <sha>` e `git push --force-with-lease`
   (cuidado, so faca se tiver certeza) **ou** use:
   `Run workflow` apontando para a tag/branch antiga (basta fazer o push
   dessa branch).

Alternativa manual via SSH:

```bash
cd ~/krato-ai
git log --oneline -20
git checkout <sha_bom>
bash scripts/vps-deploy.sh
```
