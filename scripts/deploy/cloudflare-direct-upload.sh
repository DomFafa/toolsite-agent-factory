#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-}"
PROJECT_NAME="${2:-}"

if [[ -z "$SITE_DIR" || -z "$PROJECT_NAME" ]]; then
  echo "Usage: bash scripts/deploy/cloudflare-direct-upload.sh <site-dir> <cloudflare-pages-project-name>"
  exit 1
fi

if [[ ! -d "$SITE_DIR/dist" ]]; then
  echo "Missing dist folder. Run npm run build first in $SITE_DIR."
  exit 1
fi

echo "Placeholder command: npx wrangler pages deploy $SITE_DIR/dist --project-name=$PROJECT_NAME"
echo "Agent 6 must verify approval.md before executing real upload."
