#!/bin/bash
# Script de backup automático para Krato-AI
# Executar via cron: 0 2 * * * /workspace/scripts/backup/auto-backup.sh

set -e

echo "💾 Krato-AI Backup Automático"
echo "=============================="
echo ""

# Configurações
BACKUP_DIR="${KRATO_BACKUP_DIR:-/workspace/backups}"
DATA_DIR="${KRATO_DATA_DIR:-/workspace/data}"
MAX_BACKUPS="${KRATO_MAX_BACKUPS:-7}"  # Manter últimos 7 dias

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="krato-backup-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo "📁 Diretório de dados: $DATA_DIR"
echo "📂 Diretório de backup: $BACKUP_DIR"
echo "📦 Nome do backup: $BACKUP_NAME"
echo ""

# 1. Backup do banco de dados SQLite
echo "🗄️  [1/3] Backup do banco de dados SQLite..."
if [ -f "$DATA_DIR/krato.db" ]; then
    cp "$DATA_DIR/krato.db" "$BACKUP_PATH.db"
    cp "$DATA_DIR/krato.db-shm" "$BACKUP_PATH.db-shm" 2>/dev/null || true
    cp "$DATA_DIR/krato.db-wal" "$BACKUP_PATH.db-wal" 2>/dev/null || true
    echo "✅ Banco de dados copiado"
else
    echo "⚠️  Banco de dados não encontrado, pulando..."
fi

# 2. Backup de configurações
echo "⚙️  [2/3] Backup de configurações..."
if [ -f "/workspace/.env" ]; then
    cp "/workspace/.env" "$BACKUP_PATH.env"
    echo "✅ Arquivo .env copiado (cuidado: contém secrets!)"
fi

if [ -d "/workspace/data" ]; then
    tar -czf "$BACKUP_PATH-data.tar.gz" -C /workspace data 2>/dev/null || true
    echo "✅ Diretório data compactado"
fi

# 3. Compactar backup completo
echo "📦 [3/3] Compactando backup..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" \
    "$BACKUP_NAME.db" \
    "$BACKUP_NAME.db-shm" 2>/dev/null || true
tar -rf "$BACKUP_NAME.tar" "$BACKUP_NAME.db-wal" 2>/dev/null || true
tar -rf "$BACKUP_NAME.tar" "$BACKUP_NAME.env" 2>/dev/null || true
tar -rf "$BACKUP_NAME.tar" "$BACKUP_NAME-data.tar.gz" 2>/dev/null || true

# Remove arquivos soltos e mantém apenas o tar.gz
rm -f "$BACKUP_NAME.db" "$BACKUP_NAME.db-shm" "$BACKUP_NAME.db-wal" "$BACKUP_NAME.env" "$BACKUP_NAME-data.tar.gz" 2>/dev/null || true

# Renomeia para formato final
mv "$BACKUP_NAME.tar" "$BACKUP_NAME.tar.gz" 2>/dev/null || true

FINAL_SIZE=$(du -h "$BACKUP_NAME.tar.gz" 2>/dev/null | cut -f1 || echo "desconhecido")
echo "✅ Backup compactado: $FINAL_SIZE"

echo ""
echo "🧹 Limpando backups antigos (mantendo últimos $MAX_BACKUPS)..."
cd "$BACKUP_DIR"
BACKUP_COUNT=$(ls -1 krato-backup-*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t krato-backup-*.tar.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
    echo "✅ $REMOVE_COUNT backups antigos removidos"
else
    echo "✅ Nenhum backup antigo para remover"
fi

echo ""
echo "=============================="
echo "✅ Backup concluído com sucesso!"
echo "=============================="
echo "Local: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "Tamanho: $FINAL_SIZE"
echo ""

# Listar backups existentes
echo "📋 Backups disponíveis:"
ls -lh "$BACKUP_DIR"/krato-backup-*.tar.gz 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}' || echo "   Nenhum backup encontrado"

echo ""
echo "💡 Dica: Para restaurar:"
echo "   tar -xzf $BACKUP_DIR/$BACKUP_NAME.tar.gz -C /workspace/"
echo "   cp $BACKUP_PATH.db /workspace/data/krato.db"

exit 0
