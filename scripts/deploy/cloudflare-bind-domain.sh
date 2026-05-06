#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-}"
DOMAIN="${2:-}"

if [[ -z "$PROJECT_NAME" || -z "$DOMAIN" ]]; then
  echo "Usage: bash scripts/deploy/cloudflare-bind-domain.sh <project-name> <domain>"
  exit 1
fi

echo "Placeholder: bind $DOMAIN to Cloudflare Pages project $PROJECT_NAME."
echo "Use Cloudflare dashboard or wrangler/API after confirming zone is active."
