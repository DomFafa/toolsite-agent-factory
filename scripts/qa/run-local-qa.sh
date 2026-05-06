#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-starter-site}"

bash scripts/qa/check-build.sh "$SITE_DIR"
bash scripts/qa/check-noindex.sh "$SITE_DIR"
node scripts/qa/check-basic-seo.mjs "$SITE_DIR"

echo "Local QA placeholder completed for $SITE_DIR"
