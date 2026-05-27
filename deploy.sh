#!/bin/bash
# ============================================================
# Safiron Hawale — Deploy Script
# Tüm servisler europe-west3 üzerinde çalışır.
# "gcloud run deploy --source" kullanır: imajlar otomatik olarak
# europe-west3 Artifact Registry'ye gider, ABD'ye hiçbir şey gitmez.
# ============================================================

set -e

PROJECT="safiron-dev"
REGION="europe-west3"

# Renkli çıktı
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Hangi servis(ler) deploy edilecek?
# Kullanım:
#   ./deploy.sh                 → tüm servisler
#   ./deploy.sh hawale-backend  → sadece hawale-backend
#   ./deploy.sh hawale-frontend → sadece hawale-frontend

SERVICES=("$@")
if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=("hawale-backend" "hawale-frontend")
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

deploy_service() {
  local SERVICE=$1
  local SOURCE_DIR=""

  case "$SERVICE" in
    hawale-backend)
      SOURCE_DIR="$SCRIPT_DIR/backend"
      ;;
    hawale-frontend)
      SOURCE_DIR="$SCRIPT_DIR/frontend"
      ;;
    *)
      err "Bilinmeyen servis: $SERVICE"
      ;;
  esac

  info "Deploy ediliyor: $SERVICE ($SOURCE_DIR)"

  gcloud run deploy "$SERVICE" \
    --source "$SOURCE_DIR" \
    --project "$PROJECT" \
    --region "$REGION" \
    --quiet

  log "$SERVICE deploy tamamlandı"
}

echo ""
echo "🚀 Safiron Hawale Deploy"
echo "   Proje : $PROJECT"
echo "   Bölge : $REGION"
echo "   Servis: ${SERVICES[*]}"
echo ""

for svc in "${SERVICES[@]}"; do
  deploy_service "$svc"
done

echo ""
log "Tüm deploylar tamamlandı ✨"
echo ""
