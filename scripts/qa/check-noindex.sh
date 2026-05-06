#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-starter-site}"
ENV_FILE="$SITE_DIR/.env"

if [[ -f "$ENV_FILE" ]] && grep -q "PUBLIC_INDEX_SITE=true" "$ENV_FILE"; then
  echo "WARNING: PUBLIC_INDEX_SITE=true found in $ENV_FILE. Production indexing must be approval-gated."
else
  echo "No production index flag found. Development noindex appears safe."
fi
