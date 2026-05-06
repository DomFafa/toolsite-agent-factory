#!/usr/bin/env bash
set -euo pipefail

SITE_ID="${1:-}"
DOMAIN="${2:-}"

if [[ -z "$SITE_ID" || -z "$DOMAIN" ]]; then
  echo "Usage: ./scripts/create-run.sh <site-id> <domain>"
  exit 1
fi

RUN_DIR="runs/$SITE_ID"

if [[ -e "$RUN_DIR" ]]; then
  echo "Run folder already exists: $RUN_DIR"
  exit 1
fi

mkdir -p "$RUN_DIR"/{agent-1-output,agent-2-output,agent-3-output,agent-4-output,agent-5-output,agent-6-output,assets,site}
cp shared/templates/run-input.template.md "$RUN_DIR/input.md"
cp shared/templates/approval.template.md "$RUN_DIR/approval.md"
touch "$RUN_DIR/issues.md"
cat > "$RUN_DIR/state.json" <<JSON
{
  "site_id": "$SITE_ID",
  "domain": "$DOMAIN",
  "status": "initialized",
  "current_agent": null,
  "approved_for_production": false,
  "agent_outputs": {
    "agent_1": null,
    "agent_2": null,
    "agent_3": null,
    "agent_4": null,
    "agent_5": null,
    "agent_6": null
  },
  "qa": {
    "passed": false,
    "report": null
  },
  "launch": {
    "cloudflare_project": "dom-tool-$SITE_ID",
    "production_url": "https://$DOMAIN",
    "sitemap_url": "https://$DOMAIN/sitemap.xml"
  }
}
JSON

cat > "$RUN_DIR/README.md" <<MD
# Run: $SITE_ID

- Domain: $DOMAIN
- Cloudflare Pages project: dom-tool-$SITE_ID

Fill \`input.md\`, then execute agents in order.
MD

echo "Created $RUN_DIR"
