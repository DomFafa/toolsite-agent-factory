#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-starter-site}"

if [[ ! -f "$SITE_DIR/package.json" ]]; then
  echo "Missing package.json in $SITE_DIR"
  exit 1
fi

(
  cd "$SITE_DIR"
  npm install
  npm run build
)
