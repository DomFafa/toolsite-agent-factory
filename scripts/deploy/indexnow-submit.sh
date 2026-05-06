#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
URL="${2:-}"

if [[ -z "$DOMAIN" || -z "$URL" ]]; then
  echo "Usage: bash scripts/deploy/indexnow-submit.sh <domain> <url>"
  exit 1
fi

echo "Placeholder: submit $URL for $DOMAIN through IndexNow after key is configured."
