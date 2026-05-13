# Desktop-First Production Flow

Production run behavior is governed by `docs/production-run-master-contract.md`. If this document conflicts with the contract, the contract wins.

Desktop-first is the current primary production workflow. Telegram, Hermes, and the remote worker remain available as optional later enhancements, but the desktop flow must not depend on Hermes inbox, Telegram delivery, `toolsite-inbox.jsonl`, or `remote:toolsite-worker`.

## Run Layout

Each desktop production run uses:

```txt
runs/<site-id>/
  input.md
  run-meta.json
  input-assets/
  pre-agent2-output/
  toolsite-spec.md
  agent-2-output/
  agent-2-5-output/
  agent-3-output/
  agent-4-output/
  site/
  agent-5-output/
  gate-results/
  deployment-output/
  human-review-events.jsonl
  desktop-run-state.json
```

`run-meta.json` must record `run_type: "production"`, `deployable: true`, `mode: "desktop"`, `site_id`, `target_domain`, `created_at`, and `status`.

## Scripts

- `npm run desktop:create-run -- --site-id <site-id> --input <input.md> --assets <asset-dir>`
- `npm run desktop:run -- --run-dir runs/<site-id>`
- `npm run desktop:continue -- --run-dir runs/<site-id> --review spec-confirmation --reply "确认 SPEC"`
- `npm run desktop:select-ui -- --run-dir runs/<site-id> --option A`
- `npm run desktop:agent2 -- --run-dir runs/<site-id>`
- `npm run desktop:agent25 -- --run-dir runs/<site-id>`
- `npm run desktop:implement -- --run-dir runs/<site-id>`
- `npm run desktop:qa -- --run-dir runs/<site-id>`
- `npm run desktop:deploy -- --run-dir runs/<site-id>`

The first implementation is a deterministic state-machine skeleton. It can create runs, generate a Toolsite SPEC review, record local human decisions, and block unconfigured stages with `NO_STAGE_RUNNER_CONFIGURED`.

## Human Review Points

Desktop mode uses local files and terminal output, not Telegram:

- `spec-confirmation`: user replies `确认 SPEC` or `修改：...`
- `ui-option-selection`: user chooses `A`, `B`, `C`, or replies `重做：...`
- `pre-deploy-approval`: user replies `确认部署` or `修改：...`

All review state is appended to `human-review-events.jsonl`.

## Gate Repair Loop

Ordinary gate failures should enter a repair loop before asking the user. The loop may retry a gate up to five times. Each attempt must repair real artifacts and rerun the gate. It must not edit `gate-results/*.json`, lower gate standards, write markdown as fake PASS evidence, or skip gates.

If the repair limit is exceeded, the desktop flow must block with `NEEDS_HUMAN_DECISION` and report the gate name, failure reason, attempts, and the decision needed.

## Optional Remote Flow

Remote Telegram/Hermes operation is secondary. Desktop scripts must not call:

- `read:hermes-intake`
- `continue:human-review`
- `run:toolsite --remote`
- `remote:toolsite-worker`

