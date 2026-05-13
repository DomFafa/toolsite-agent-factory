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

- `npm run desktop:intake -- --input <intake.md>`
- `npm run desktop:intake -- --site-id <site-id> --keyword <keyword> --domain <domain> --ui-ref <url-or-note> --ux-ref <url-or-note> --notes <text> --assets <file-or-dir>`
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

## Step 0: `desktop:intake`

`desktop:intake` is the first desktop-first step before Pre-Agent2. It creates a clean production run from the five required elements plus optional screenshots or reference images.

Markdown input:

```md
# Toolsite intake

- 关键词: 401K Calculator
- 目标域名: 401k-calculator.net
- UI 参考: https://www.usa.gov
- UX 参考: https://www.calculator.net/401k-calculator.html
- 额外想法 / 限制 / 模仿点: 对老人家友好；第一屏就是计算器；只做 educational estimate；不要登录、不要后端、不要数据库。
- 截图 / 参考图: ./reference.png
```

Run from a Markdown intake file:

```bash
npm run desktop:intake -- --input path/to/intake.md
```

Run from command arguments:

```bash
npm run desktop:intake -- \
  --site-id <site-id> \
  --keyword <keyword> \
  --domain <domain> \
  --ui-ref <url-or-note> \
  --ux-ref <url-or-note> \
  --notes <text> \
  --assets <file-or-dir>
```

Behavior:

- Missing five elements fail with `INCOMPLETE_INTAKE`.
- Existing `runs/<site-id>/` fails with `RUN_ALREADY_EXISTS`.
- Screenshots and reference images are optional.
- If the intake mentions `参考图`, `截图`, `参考我发的图`, `插画参考`, or `按图片风格`, an asset must be provided or the command fails with `MISSING_INPUT_ASSET`.
- Provided assets are copied into `input-assets/`.
- Asset usage is recorded in `input.md` and `run-meta.json` as `design_reference`, `illustration_reference`, or `screenshot_reference`.
- `desktop-run-state.json` starts at `stage: "pre-agent2"` with `last_completed_stage: "intake"`.

Next step:

```bash
npm run desktop:pre-agent2 -- --run-dir runs/<site-id>
```

## `desktop:agent2`

`desktop:agent2` is the desktop-first stage after SPEC confirmation and before Agent2.5 UI generation.

Purpose:

- Turn the confirmed `toolsite-spec.md` into Agent2 working documents.
- Run the machine checks needed before Agent2.5 may start.
- Stop at `stage: "agent25"` when Agent2 output and compliance pass.

It does not:

- Ask for routine human review of the Agent2 brief.
- Start Agent2.5.
- Generate UI option images.
- Implement the site.
- Deploy.
- Use Telegram, Hermes, `toolsite-inbox.jsonl`, or the remote worker.

Run it directly:

```bash
npm run desktop:agent2 -- --run-dir runs/<site-id>
```

Or let the desktop state machine continue from the current stage:

```bash
npm run desktop:run -- --run-dir runs/<site-id>
```

Preconditions:

- `toolsite-spec.md` exists.
- The SPEC has been confirmed.
- `human-review-events.jsonl` contains a resolved `spec-confirmation` event with `resolution_text: "确认 SPEC"`.
- `run-meta.json` describes a desktop production run.
- `desktop-run-state.json` is normally at `stage: "agent2"` after `desktop:continue` resolves SPEC confirmation.

Inputs read:

- `toolsite-spec.md`
- `input.md`
- `run-meta.json`
- `desktop-run-state.json`
- `human-review-events.jsonl`
- `input-assets/` references when listed by the SPEC or input

Outputs written:

- `agent-2-output/site-brief.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/content-plan.md`
- `agent-2-output/seo-plan.md`
- `agent-2-output/page-plan.md`
- `agent-2-output/ui-reference-dossier.md`
- `agent-2-output/design-generation-input.md`
- `agent-2-output/brief-compliance-summary.md`
- `gate-results/pre-agent2-toolsite-spec.json`
- `gate-results/page-plan.json`
- `gate-results/agent2-brief-compliance.json`
- updated `desktop-run-state.json`

Gates run:

- `pre-agent2-toolsite-spec`
- `page-plan`
- `agent2-brief-compliance`

Failure behavior:

- If SPEC is not confirmed, it returns `HUMAN_REVIEW_REQUIRED`, keeps or returns the state to `spec-review`, and does not write Agent2 outputs.
- If `toolsite-spec.md` is missing or invalid, the Pre-Agent2 SPEC gate fails and the state remains blocked at `agent2`.
- If Page Plan or Agent2 brief compliance fails, it writes the gate result, keeps the state at `agent2`, and reports `AGENT2_COMPLIANCE_FAILED`.
- It must not fake Agent2 success or advance to Agent2.5 when compliance fails.

Success behavior:

- `agent-2-output/*` is complete.
- `gate-results/agent2-brief-compliance.json` passes with `can_proceed_to_agent25: true`.
- `desktop-run-state.json` is updated to `stage: "agent25"`.
- The flow stops before Agent2.5.

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
