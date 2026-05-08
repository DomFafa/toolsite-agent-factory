# QA Run Log

Date: 2026-05-08

## Agent 2.5 Chat Selection

- Sent three GPT-generated options to chat as `agent-2-5-output/chat-delivery/options-board.png`.
- Waited 3 minutes for user selection.
- No reply received within the timeout.
- Defaulted to GPT-recommended `Option A - Benchmark Console`.
- Recorded decision in `agent-2-5-output/chat-delivery/option-selection.md`.

## Validation Commands

- `npm run build` in `runs/typing-test-online/site` - pass.
- `npm run test:run-gates` - pass.
- `npm run test:web-access-preflight` - pass.
- `npm run test:ui-ux-gates` - pass.
- `npm run test:asset-quality` - pass.
- `node scripts/run/check-web-access.mjs --run-dir runs/typing-test-online --write` - pass.
- `node scripts/run/check-agent25-lineage.mjs --run-dir runs/typing-test-online --write` - pass.
- `node scripts/run/check-gates.mjs --run-dir runs/typing-test-online --before agent-3 --json` - pass.
- `node scripts/qa/check-tool-spec.mjs --run-dir runs/typing-test-online --write` - pass after adding missing result fields.
- `node scripts/qa/check-final-visual-lock.mjs --run-dir runs/typing-test-online --url http://127.0.0.1:4327/ --write` - pass.
- `node scripts/qa/check-final-visual-similarity.mjs --run-dir runs/typing-test-online --write` - pass, overall similarity `97%`.
- `node scripts/qa/check-rendered-assets.mjs --run-dir runs/typing-test-online --url http://127.0.0.1:4327/ --write` - pass.
- `node scripts/design/asset-quality-gate.mjs --run-dir runs/typing-test-online` - pass, no referenced UI image assets.
- `node scripts/qa/check-basic-seo.mjs runs/typing-test-online/site` - pass.
- `bash scripts/qa/check-noindex.sh runs/typing-test-online/site/dist` - pass.
- `npm audit --omit=dev --json` - pass, `0` production dependency vulnerabilities.
- `node scripts/qa/check-final-qa-evidence.mjs --run-dir runs/typing-test-online --write` - pass.

## Browser Checks

- Production preview used for final screenshots: `http://127.0.0.1:4327/`.
- Dev server toolbar was excluded from final evidence by using production preview rather than Astro dev.
- Desktop result flow typed the full default passage and verified the expanded result summary.
- Bulk fill attempt was blocked with input reset to empty and no result panel shown.
- Mobile viewport verified `scrollWidth === innerWidth`.

## Issue Found And Fixed

The new tool-spec gate caught missing post-test fields: `Incorrect characters` and `Correct words`. Agent 4 implementation was updated to include the full result set required by Agent 2.
