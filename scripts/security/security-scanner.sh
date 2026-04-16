#!/bin/bash
# Script de segurança para scan de secrets e vulnerabilidades
# Requer: gitleaks, trufflehog (opcionais)

set -e

echo "🔒 Krato-AI Security Scanner"
echo "============================"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="${1:-.}"
REPORT_DIR="$PROJECT_DIR/security-reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "📁 Escaneando diretório: $PROJECT_DIR"
echo "📂 Reports serão salvos em: $REPORT_DIR"
echo ""

# 1. Scan com Gitleaks (se disponível)
if command -v gitleaks &> /dev/null; then
    echo "🔍 [1/3] Executando Gitleaks..."
    
    if gitleaks detect --source "$PROJECT_DIR" --report-path "$REPORT_DIR/gitleaks-$TIMESTAMP.json" --report-format json --verbose 2>/dev/null; then
        echo -e "${GREEN}✅ Gitleaks: Nenhum segredo encontrado${NC}"
    else
        echo -e "${YELLOW}⚠️  Gitleaks: Segredos potenciais encontrados! Verifique o report${NC}"
        echo "   Report: $REPORT_DIR/gitleaks-$TIMESTAMP.json"
    fi
else
    echo -e "${YELLOW}⚠️  Gitleaks não instalado. Pulando...${NC}"
    echo "   Instale com: brew install gitleaks ou wget https://github.com/zricethezav/gitleaks/releases"
fi

echo ""

# 2. Scan com TruffleHog (se disponível)
if command -v trufflehog &> /dev/null; then
    echo "🔍 [2/3] Executando TruffleHog..."
    
    if trufflehog filesystem "$PROJECT_DIR" --json > "$REPORT_DIR/trufflehog-$TIMESTAMP.json" 2>&1; then
        echo -e "${GREEN}✅ TruffleHog: Nenhum segredo encontrado${NC}"
    else
        echo -e "${YELLOW}⚠️  TruffleHog: Segredos potenciais encontrados! Verifique o report${NC}"
        echo "   Report: $REPORT_DIR/trufflehog-$TIMESTAMP.json"
    fi
else
    echo -e "${YELLOW}⚠️  TruffleHog não instalado. Pulando...${NC}"
    echo "   Instale com: docker run -it -v \"\$PWD:/pwd\" trufflesecurity/trufflehog:latest github --repo https://github.com/trufflesecurity/test_keys"
fi

echo ""

# 3. Scan manual de padrões comuns
echo "🔍 [3/3] Scan manual de padrões comuns..."
MANUAL_REPORT="$REPORT_DIR/manual-scan-$TIMESTAMP.txt"

FOUND_ISSUES=0

# Padrões a buscar
PATTERNS=(
    "api[_-]?key\s*[=:]\s*['\"][^'\"]{8,}['\"]"
    "password\s*[=:]\s*['\"][^'\"]+['\"]"
    "secret\s*[=:]\s*['\"][^'\"]+['\"]"
    "token\s*[=:]\s*['\"][^'\"]{16,}['\"]"
    "AWS_ACCESS_KEY_ID\s*[=:]\s*['\"]?AKIA[A-Z0-9]{16}"
    "AWS_SECRET_ACCESS_KEY\s*[=:]\s*['\"][^'\"]{40}['\"]"
    "PRIVATE KEY"
    "-----BEGIN RSA PRIVATE KEY-----"
    "-----BEGIN OPENSSH PRIVATE KEY-----"
    "ghp_[a-zA-Z0-9]{36}"
    "glpat-[a-zA-Z0-9\-]{20}"
    "xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*"
)

for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(grep -rE "$pattern" "$PROJECT_DIR" \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=dist \
        --exclude="*.lock" \
        --exclude="security-scanner.sh" \
        --exclude="*.md" \
        2>/dev/null || true)
    
    if [ -n "$MATCHES" ]; then
        echo -e "${RED}❌ Padrão encontrado: $pattern${NC}" >> "$MANUAL_REPORT"
        echo "$MATCHES" >> "$MANUAL_REPORT"
        echo "" >> "$MANUAL_REPORT"
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
done

if [ $FOUND_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Scan manual: Nenhum padrão suspeito encontrado${NC}"
    echo "Nenhum padrão suspeito encontrado." > "$MANUAL_REPORT"
else
    echo -e "${RED}❌ Scan manual: $FOUND_ISSUES padrões suspeitos encontrados!${NC}"
    echo "   Report: $MANUAL_REPORT"
fi

echo ""

# 4. Verificação de arquivos sensíveis
echo "🔍 Verificando arquivos sensíveis..."
SENSITIVE_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    "id_rsa"
    "id_ed25519"
    "*.pem"
    "*.key"
    "credentials.json"
    "service-account.json"
)

FOUND_SENSITIVE=0
for file in "${SENSITIVE_FILES[@]}"; do
    if find "$PROJECT_DIR" -path "*/node_modules" -prune -o -path "*/.git" -prune -o -name "$file" -print 2>/dev/null | grep -q .; then
        FOUND_FILES=$(find "$PROJECT_DIR" -path "*/node_modules" -prune -o -path "*/.git" -prune -o -name "$file" -print 2>/dev/null)
        echo -e "${YELLOW}⚠️  Arquivo sensível encontrado: $file${NC}"
        echo "$FOUND_FILES" >> "$MANUAL_REPORT"
        FOUND_SENSITIVE=$((FOUND_SENSITIVE + 1))
    fi
done

if [ $FOUND_SENSITIVE -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum arquivo sensível exposto${NC}"
else
    echo -e "${YELLOW}⚠️  $FOUND_SENSITIVE arquivos sensíveis encontrados${NC}"
fi

echo ""
echo "============================"
echo "📊 Resumo do Security Scan"
echo "============================"
echo "Reports salvos em: $REPORT_DIR"
echo ""

if [ $FOUND_ISSUES -gt 0 ] || [ $FOUND_SENSITIVE -gt 0 ]; then
    echo -e "${RED}⚠️  ATENÇÃO: Foram encontradas possíveis vulnerabilidades!${NC}"
    echo "Revise os reports antes de fazer commit/push."
    exit 1
else
    echo -e "${GREEN}✅ Nenhum problema crítico encontrado${NC}"
    exit 0
fi
