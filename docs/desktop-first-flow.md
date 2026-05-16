# Desktop-First Production Flow

Production run behavior is governed by `docs/production-run-master-contract.md`. If this document conflicts with the contract, the contract wins.

desktop-first is the only active production workflow in this repository. New production runs start from local desktop intake, local SPEC confirmation, local UI A/B/C selection, local pre-deploy approval, and machine-readable gates.

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

## Active Scripts

- `npm run desktop:intake -- --input <intake.md>`
- `npm run desktop:intake -- --site-id <site-id> --keyword <keyword> --domain <domain> --ui-ref <url-or-note> --ux-ref <url-or-note> --notes <text> --assets <file-or-dir>`
- `npm run desktop:create-run -- --site-id <site-id> --input <input.md> --assets <asset-dir>`
- `npm run desktop:pre-agent2 -- --run-dir runs/<site-id>`
- `npm run desktop:agent2 -- --run-dir runs/<site-id>`
- `npm run desktop:agent25 -- --run-dir runs/<site-id>`
- `npm run desktop:select-ui -- --run-dir runs/<site-id> --option A`
- `npm run desktop:implement -- --run-dir runs/<site-id>`
- `npm run desktop:qa -- --run-dir runs/<site-id>`
- `npm run desktop:deploy -- --run-dir runs/<site-id>`
- `npm run desktop:run -- --run-dir runs/<site-id>`
- `npm run desktop:continue -- --run-dir runs/<site-id> --review <review-type> --reply <reply>`

The current implementation is a deterministic local state machine. It can create runs, generate a Toolsite SPEC review, record local human decisions, run Agent2, Agent2.5 option selection, selected-assets packaging, and Agent3/Agent4 implementation up to the QA boundary. Unconfigured later stages still block with `NO_STAGE_RUNNER_CONFIGURED`.

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

Behavior:

- Missing five elements fail with `INCOMPLETE_INTAKE`.
- Existing `runs/<site-id>/` fails with `RUN_ALREADY_EXISTS`.
- Screenshots and reference images are optional.
- If the intake mentions `参考图`, `截图`, `参考我发的图`, `插画参考`, or `按图片风格`, an asset must be provided or the command fails with `MISSING_INPUT_ASSET`.
- Provided assets are copied into `input-assets/`.
- Asset usage is recorded in `input.md` and `run-meta.json` as `design_reference`, `illustration_reference`, or `screenshot_reference`.
- `desktop-run-state.json` starts at `stage: "pre-agent2"` with `last_completed_stage: "intake"`.

## Pre-Agent2 SPEC Confirmation

`desktop:pre-agent2` reads `input.md`, writes `toolsite-spec.md`, and appends an open local review event to `human-review-events.jsonl`.

The SPEC review event uses:

- `review_type: "spec-confirmation"`
- `status: "open"`
- `blocking: true`
- `expected_reply: "确认 SPEC / 修改：..."`

The user resolves it with:

```bash
npm run desktop:continue -- --run-dir runs/<site-id> --review spec-confirmation --reply "确认 SPEC"
```

If the user replies with `修改：...`, Codex must apply the requested change and regenerate the SPEC before Agent2.

## `desktop:agent2`

`desktop:agent2` runs after the local SPEC review has been resolved with `确认 SPEC` and before Agent2.5 UI generation.

Run it with:

```bash
npm run desktop:agent2 -- --run-dir runs/<site-id>
```

Purpose:

- Turn the confirmed `toolsite-spec.md` into Agent2 working documents.
- Run the machine checks needed before Agent2.5 may start.
- Stop at `stage: "agent25"` when Agent2 output and compliance pass.

Required preconditions:

- `runs/<site-id>/toolsite-spec.md` exists.
- `human-review-events.jsonl` contains a resolved `spec-confirmation` event with `resolution_text: "确认 SPEC"`.
- `desktop-run-state.json` is currently at `stage: "spec-review"` or `stage: "agent2"`.
- `run-meta.json` describes a desktop production run: `mode: "desktop"`, `run_type: "production"`, and `deployable: true`.

It does not:

- Ask for routine human review of the Agent2 brief.
- Start Agent2.5.
- Generate UI option images.
- Implement the site.
- Deploy.
- Use any off-machine operation channel.

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
- If `run-meta.json` is not a desktop production run, it returns `DESKTOP_PRECONDITION_FAILED`, keeps the state at `agent2`, and writes `blocking_reason: "desktop-production-run-required"`.
- If the current state is not `spec-review` or `agent2`, it returns `DESKTOP_PRECONDITION_FAILED`, keeps the state at `agent2`, and writes `blocking_reason: "invalid-stage:<stage>"`.
- If `toolsite-spec.md` is missing or invalid, the Pre-Agent2 SPEC gate writes `gate-results/pre-agent2-toolsite-spec.json`, keeps the state at `agent2`, and writes `blocking_reason: "pre-agent2-toolsite-spec"`.
- If Page Plan fails, it writes `gate-results/page-plan.json` and `gate-results/agent2-brief-compliance.json`, keeps the state at `agent2`, and writes `blocking_reason: "page-plan"`.
- If Agent2 brief compliance fails, it writes `gate-results/agent2-brief-compliance.json`, keeps the state at `agent2`, and writes `blocking_reason: "agent2-brief-compliance"`.
- It must not fake Agent2 success or advance to Agent2.5 when compliance fails.

Success behavior:

- `agent-2-output/*` is complete.
- `gate-results/agent2-brief-compliance.json` passes with `can_proceed_to_agent25: true`.
- `desktop-run-state.json` is updated with `stage: "agent25"`, `last_completed_stage: "agent2"`, `next_action: "run desktop:agent25"`, and `blocking_reason: null`.
- The flow stops before Agent2.5.

## `desktop:agent25`

`desktop:agent25` runs after `desktop:agent2` has passed compliance and set `desktop-run-state.json` to `stage: "agent25"`.

Run it with:

```bash
npm run desktop:agent25 -- --run-dir runs/<site-id>
```

`desktop:run` also calls this runner automatically when the current desktop state is `agent25`.

Purpose:

- Read `agent-2-output/design-generation-input.md` and referenced `input-assets/`.
- Call the approved Agent2.5 design-options executor.
- Generate reviewable high-fidelity A/B/C UI option evidence.
- Write a local blocking UI option review and stop before Agent3.

Required preconditions:

- `desktop-run-state.json` has `stage: "agent25"` and `last_completed_stage: "agent2"`.
- `agent-2-output/design-generation-input.md` exists.
- `agent-2-output/site-brief.md` exists.
- `gate-results/agent2-brief-compliance.json` is passing.
- `input-assets/` is readable when the run references image assets.

Executor called:

```bash
node scripts/run/execute-agent25-design-options.mjs \
  --run-dir runs/<site-id> \
  --prompt runs/<site-id>/agent-2-output/design-generation-input.md
```

Agent2.5 must preserve the external action evidence runner split:

- `scripts/run/execute-agent25-design-options.mjs` owns the real browser/CDP/web-access execution for design-options.
- `scripts/run/run-agent25-external-action.mjs` signs captured evidence, writes `action-receipt.json`, and computes hashes.
- `scripts/run/check-agent25-external-design-proof.mjs` validates receipts, artifacts, hashes, lineage, and proof.

Outputs written by a successful executor run include:

- `agent-2-5-output/external-design-evidence/action-receipt.json`
- `agent-2-5-output/external-design-evidence/conversation-screenshot.png`
- `agent-2-5-output/external-design-evidence/external-response.md`
- `agent-2-5-output/chat-delivery/options-board.png`
- `gate-results/agent25-external-design-proof.json`
- `gate-results/agent25-option-images.json`
- an open local `agent25_option_selection` review event in `human-review-events.jsonl`

Gates run:

- `agent25-external-design-proof`
- `agent25-option-images`

Failure behavior:

- If Agent2 has not completed, it returns `INVALID_DESKTOP_STAGE`.
- If Agent2 outputs are missing, it returns `AGENT2_OUTPUT_MISSING` and keeps `stage: "agent25"`.
- If Agent2 compliance is missing or failing, it returns `AGENT2_COMPLIANCE_REQUIRED` and keeps `stage: "agent25"`.
- If referenced image assets cannot be read, it returns `INPUT_ASSETS_UNREADABLE` and keeps `stage: "agent25"`.
- If the executor returns `NO_APPROVED_UI_GENERATION_AVAILABLE` or `EXTERNAL_ACTION_FAILED`, it records that value in `blocking_reason`, keeps `stage: "agent25"`, and does not create local fallback images.
- If either Agent2.5 gate fails, it writes the failing gate result, keeps `stage: "agent25"`, and does not enter UI review.

Provider unavailable behavior:

- A missing or unavailable approved design surface is a hard block.
- The desktop runner does not fabricate option images with local HTML, CSS, SVG, markdown, or screenshots.
- Re-run `desktop:agent25` only after the approved design surface and evidence runner are available.

The desktop UI decision is local:

- The option board is written under `agent-2-5-output/chat-delivery/`.
- The open `agent25_option_selection` review event is appended to `human-review-events.jsonl`.
- The user chooses `A`, `B`, `C`, or `重做：...` through `desktop:continue` or `desktop:select-ui`.

Success behavior:

- `desktop-run-state.json` is updated with `stage: "ui-review"`, `last_completed_stage: "agent25"`, `next_action: "review Agent2.5 options and run desktop:select-ui"`, and `blocking_reason: "ui-option-selection"`.
- The flow stops at UI review.
- It does not enter Agent3.
- It does not implement selected assets.
- It does not deploy.

## `desktop:select-ui`

`desktop:select-ui` runs after `desktop:agent25` has generated the A/B/C options board and opened the local `agent25_option_selection` review.

Run it with:

```bash
npm run desktop:select-ui -- --run-dir runs/<site-id> --option A
```

Valid options are `A`, `B`, and `C`. Any other value returns `INVALID_UI_OPTION`.

Purpose:

- Resolve the open local Agent2.5 UI option review using append-only events.
- Record the selected A/B/C option and selected design label.
- Preserve the link to the Agent2.5 options board and external action receipt.
- Check whether the run is ready to move to implementation without starting Agent3.

Required preconditions:

- `desktop-run-state.json` has `stage: "ui-review"` and `last_completed_stage: "agent25"`.
- `human-review-events.jsonl` contains an open `agent25_option_selection` or `desktop_ui_option_selection` review.
- `agent-2-5-output/chat-delivery/options-board.png` exists.
- `agent-2-5-output/external-design-evidence/action-receipt.json` exists.
- `agent25-external-design-proof` passes or can be rerun to pass.
- `agent25-option-images` passes or can be rerun to pass.

Events appended:

- `review_type: "agent25_option_selection"`
- `status: "resolved"`
- `resolution_text: "A"`, `"B"`, or `"C"`
- `selected_option: "A"`, `"B"`, or `"C"`
- `selected_design: "Option A"`, `"Option B"`, or `"Option C"`
- `blocking: false`

Existing open events are not edited.

Selected design outputs written:

- `agent-2-5-output/selected-design/selected-option.json`
- `agent-2-5-output/selected-design/selected-design-lineage.md`

`selected-option.json` records the selected option, selected design label, source options board, external action receipt, timestamp, and `selection_source: "desktop:select-ui"`.

`selected-design-lineage.md` records that the current user selected the option, where the options board came from, which external action receipt it maps to, that the selection is not a Codex local self-signed design choice, and that Agent3/4 must not switch to a different option.

Gates run or verified:

- `agent25-external-design-proof`
- `agent25-option-images`
- `agent25-lineage`
- `selected-assets`

Failure behavior:

- Outside `ui-review`, it returns `UI_REVIEW_REQUIRED`.
- Missing option board or action receipt returns `AGENT25_OUTPUT_MISSING`.
- Failing external proof returns `AGENT25_EXTERNAL_PROOF_REQUIRED`.
- Failing option image evidence returns `AGENT25_OPTION_IMAGE_REQUIRED`.
- If formal selected-assets or lineage requirements are not ready, it appends the resolved selection, writes the selected-design artifacts, keeps `stage: "ui-review"`, sets `blocking_reason: "SELECTED_ASSETS_NOT_READY"`, and writes `next_action: "complete selected-assets / lineage requirements before implement"`.

Success behavior:

- If the selected design artifacts exist and all post-selection requirements pass, `desktop-run-state.json` is updated with `stage: "implement"`, `last_completed_stage: "ui-selection"`, `next_action: "run desktop:implement"`, and `blocking_reason: null`.
- The flow stops before Agent3.
- It does not create selected-assets through a new external action.
- It does not deploy.

## `desktop:selected-assets`

`desktop:selected-assets` runs after `desktop:select-ui` has recorded the user's A/B/C choice. It turns the selected option into the local selected design package required before implementation may begin.

Run it with:

```bash
npm run desktop:selected-assets -- --run-dir runs/<site-id>
```

`desktop:run` also calls this runner automatically when `desktop-run-state.json` is at `stage: "ui-review"` and `agent-2-5-output/selected-design/selected-option.json` already exists.

Purpose:

- Read the selected option written by `desktop:select-ui`.
- Preserve the link to `agent-2-5-output/chat-delivery/options-board.png`.
- Preserve the link to `agent-2-5-output/external-design-evidence/action-receipt.json`.
- Generate the selected design package and selected-assets manifest required by the existing gates.
- Run the selected-assets, lineage, design-review subset, and before-Agent3 gates.
- Stop before Agent3.

Required preconditions:

- `desktop-run-state.json` has `stage: "ui-review"`.
- `agent-2-5-output/selected-design/selected-option.json` exists and contains `selected_option: "A"`, `"B"`, or `"C"`.
- `human-review-events.jsonl` contains a resolved `agent25_option_selection` event.
- `agent-2-5-output/chat-delivery/options-board.png` exists.
- `agent-2-5-output/external-design-evidence/action-receipt.json` exists.
- `agent25-external-design-proof` passes.
- `agent25-option-images` has a passing gate result, or can still be rerun to pass.

Inputs read:

- `agent-2-5-output/selected-design/selected-option.json`
- `agent-2-5-output/selected-design/selected-design-lineage.md`
- `agent-2-5-output/chat-delivery/options-board.png`
- `agent-2-5-output/external-design-evidence/action-receipt.json`
- Agent2.5 external proof, source provenance, option image paths, and selected target paths
- existing Agent2 output and gate results needed by `check-gates --before agent-3`

Outputs written:

- `agent-2-5-output/selected-assets/selected-assets-manifest.json`
- `agent-2-5-output/selected-assets/selected-design-package.md`
- `agent-2-5-output/selected-assets/selected-design-lineage.md`
- `agent-2-5-output/selected-assets/source-map.json`
- `agent-2-5-output/selected-assets/selected-target-desktop.png`
- `agent-2-5-output/selected-assets/selected-target-mobile.png`
- `agent-2-5-output/design-manifest.md`
- `agent-2-5-output/design-generation-prompt.md`
- `agent-2-5-output/design-generation-report.md`
- `agent-2-5-output/asset-acquisition-report.md`
- `agent-2-5-output/selected-design/asset-manifest.json`
- `agent-2-5-output/selected-design/image-slots.md`
- `agent-2-5-output/selected-design/design-tokens.md`
- `agent-2-5-output/selected-design/component-spec.md`
- `agent-2-5-output/selected-design/asset-plan.md`
- `agent-2-5-output/selected-design/usability-contract.md`
- `agent-2-5-output/selected-design/asset-quality-contract.md`
- `agent-2-5-output/selected-design/interaction-state-model.md`
- `agent-2-5-output/selected-design/dynamic-data-fit.md`
- `agent-2-5-output/selected-design/ux-self-audit.md`
- `agent-2-5-output/selected-design/restoration-rules.md`
- `agent-2-5-output/selected-design/forbidden-deviations.md`
- `agent-2-5-output/selected-design/selection-rationale.md`
- `agent-2-5-output/selected-design/code/index.html`
- `agent-2-5-output/selected-design/code/style.css`
- `agent-5-output/design-package-gate-report.md`
- `gate-results/agent25-external-design-proof.json`
- `gate-results/agent25-lineage.json`
- `gate-results/selected-assets.json`
- `gate-results/toolsite-design-review.json`
- `gate-results/before-agent-3.json`

`selected-assets-manifest.json` records the selected option, selected design label, source options board, external action receipt, source provenance path, selected timestamp, `generated_by: "desktop:selected-assets"`, artifact hashes, and whether a new external action was required.

Target image handling:

- If the selected target images already match the selected option's externally evidenced proof, the runner reuses them.
- If the selected option can be traced to an existing externally evidenced option image, the runner may align the selected target files to that option and refresh the evidence receipt through the existing Agent2.5 evidence runner.
- If the selected target cannot be traced to existing external evidence, it returns `SELECTED_ASSETS_NOT_READY` or `NO_APPROVED_UI_GENERATION_AVAILABLE`.
- It does not generate local HTML/CSS/SVG/markdown images as a substitute for selected target images.

Gates run:

- `agent25-external-design-proof`
- `agent25-lineage`
- `selected-assets`
- `toolsite-design-review`
- `check-gates --before agent-3`

Failure behavior:

- Outside `ui-review`, it returns `UI_SELECTION_REQUIRED`.
- Missing or invalid selected option returns `SELECTED_OPTION_MISSING`.
- Missing options board or action receipt returns `AGENT25_OUTPUT_MISSING`.
- Failing external proof returns `AGENT25_EXTERNAL_PROOF_REQUIRED`.
- Missing or failing option image evidence returns `AGENT25_OPTION_IMAGE_REQUIRED`.
- Failing selected-assets, lineage, design-review, or before-Agent3 gates keeps `stage: "ui-review"` and writes `blocking_reason: "SELECTED_ASSETS_GATE_FAILED"`.

Success behavior:

- `gate-results/selected-assets.json`, `gate-results/agent25-lineage.json`, and `gate-results/before-agent-3.json` pass.
- `desktop-run-state.json` is updated with `stage: "implement"`, `last_completed_stage: "selected-assets"`, `next_action: "run desktop:implement"`, and `blocking_reason: null`.
- The flow stops before Agent3.
- It does not deploy.

## `desktop:implement`

`desktop:implement` runs after `desktop:selected-assets` has passed selected-assets, lineage, design-review, and before-Agent3 gates. It connects the Agent3 handoff and Agent4 Astro implementation steps, then stops before Agent5 QA.

Run it with:

```bash
npm run desktop:implement -- --run-dir runs/<site-id>
```

`desktop:run` also calls this runner automatically when `desktop-run-state.json` is at `stage: "implement"`.

Purpose:

- Read the confirmed SPEC, Agent2 brief/tool/page/design input, and selected-assets package.
- Preserve the user-selected A/B/C design without reselecting or redesigning it.
- Generate the Agent3 implementation handoff artifacts.
- Generate an Astro static site under `site/`.
- Run the local site build.
- Stop at `stage: "qa"` before Agent5 QA.

Required preconditions:

- `desktop-run-state.json` has `stage: "implement"` and `last_completed_stage: "selected-assets"`.
- `toolsite-spec.md` exists.
- `agent-2-output/site-brief.md` exists.
- `agent-2-output/tool-spec.md` exists.
- `agent-2-output/page-plan.md` exists.
- `agent-2-output/design-generation-input.md` exists.
- `agent-2-5-output/selected-assets/selected-assets-manifest.json` exists.
- `agent-2-5-output/selected-assets/selected-design-package.md` exists.
- `agent-2-5-output/selected-assets/selected-design-lineage.md` exists.
- `agent-2-5-output/selected-assets/selected-target-desktop.png` exists.
- `agent-2-5-output/selected-assets/selected-target-mobile.png` exists.
- `check-gates --before agent-3` passes or can be rerun to pass.

Inputs read:

- `toolsite-spec.md`
- `agent-2-output/site-brief.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/page-plan.md`
- `agent-2-output/design-generation-input.md`
- `agent-2-5-output/selected-assets/selected-assets-manifest.json`
- `agent-2-5-output/selected-assets/selected-design-package.md`
- `agent-2-5-output/selected-assets/selected-design-lineage.md`
- `agent-2-5-output/selected-assets/selected-target-desktop.png`
- `agent-2-5-output/selected-assets/selected-target-mobile.png`

Agent3 outputs written:

- `agent-3-output/ui-direction.md`
- `agent-3-output/implementation-handoff.md`
- `agent-3-output/selected-design-summary.md`
- `agent-3-output/visual-targets.md`

These Agent3 files must reference the selected-assets manifest, selected design lineage, and desktop/mobile target image paths. They must not switch the selected A/B/C option or create a new UI direction.

Agent4 and site outputs written:

- `site/package.json`
- `site/astro.config.mjs`
- `site/tsconfig.json`
- `site/src/pages/index.astro`
- `site/src/pages/privacy.astro`
- `site/src/pages/terms.astro`
- `site/src/pages/sitemap.xml.ts`
- `site/src/styles/global.css`
- `site/public/robots.txt`
- `site/public/favicon.svg`
- `agent-4-output/implementation-report.md`
- `agent-4-output/changed-files.md`
- `agent-4-output/build-report.md`

Implementation requirements:

- The first viewport is the actual working tool, not a marketing hero.
- The implementation follows `toolsite-spec.md`, Agent2 `tool-spec.md`, Agent2 `page-plan.md`, and the selected design package.
- The site remains static Astro with browser-local behavior.
- It does not add backend, database, login, accounts, server APIs, upload, saved history, or unapproved pages.
- It includes the page-plan required pages and crawler files: `/`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml`.

Checks run:

- `check-gates --before agent-3`
- `npm run build` in `site/`

Failure behavior:

- Outside the implementation state, it returns `IMPLEMENT_STAGE_REQUIRED`.
- Missing SPEC returns `SPEC_MISSING`.
- Missing Agent2 files returns `AGENT2_OUTPUT_MISSING`.
- Missing selected-assets package files returns `SELECTED_ASSETS_MISSING`.
- Missing selected target images returns `SELECTED_TARGET_MISSING`.
- Failing `check-gates --before agent-3` returns `AGENT3_GATE_BLOCKED`, keeps `stage: "implement"`, and does not generate the site.
- If the build fails, it writes `agent-4-output/build-report.md`, keeps `stage: "implement"`, and writes `blocking_reason: "BUILD_FAILED"`.

Success behavior:

- Agent3 output, Agent4 reports, and the Astro site are written.
- The site build passes.
- `desktop-run-state.json` is updated with `stage: "qa"`, `last_completed_stage: "implement"`, `next_action: "run desktop:qa"`, and `blocking_reason: null`.
- The flow stops before Agent5 QA.
- It does not run full QA.
- It does not deploy.

## `desktop:qa`

`desktop:qa` runs after `desktop:implement` has created the Astro site and advanced the desktop state to `stage: "qa"`. It performs Agent5 local QA, repairs ordinary gate failures up to the retry limit, then stops at deployment review.

Run it with:

```bash
npm run desktop:qa -- --run-dir runs/<site-id>
```

`desktop:run` also calls this runner automatically when `desktop-run-state.json` is at `stage: "qa"`.

Purpose:

- Read the implemented `site/`.
- Re-run build and production QA gates.
- Use the local repair loop for ordinary gate failures.
- Write Agent5 QA reports and launch readiness.
- Open a local pre-deploy approval review.
- Stop before deployment.

Required preconditions:

- `desktop-run-state.json` has `stage: "qa"` and `last_completed_stage: "implement"`.
- `site/` exists.
- `agent-4-output/build-report.md` exists.
- `agent-3-output/implementation-handoff.md` exists.
- `agent-2-output/tool-spec.md` exists.
- `agent-2-output/page-plan.md` exists.
- `agent-2-5-output/selected-assets/selected-assets-manifest.json` exists.

Inputs read:

- `site/`
- `agent-4-output/build-report.md`
- `agent-3-output/implementation-handoff.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/page-plan.md`
- `agent-2-5-output/selected-assets/selected-assets-manifest.json`
- existing gate results and Agent2.5 selected design evidence required by the QA gates

QA gates run:

- `site-build` by running `npm run build` in `site/`
- `page-plan`
- `tool-spec`
- `rendered-assets`
- `final-visual-lock`
- `visual-restoration-similarity`
- `final-visual-similarity`
- `selected-assets`
- `agent25-lineage`
- `toolsite-design-review`
- `final-qa-evidence`
- `gate-evidence-integrity`
- `check-gates --before agent-6`

Outputs written:

- `agent-5-output/qa-report.md`
- `agent-5-output/final-qa-report.md`
- `agent-5-output/launch-readiness.md`
- `agent-5-output/repair-log.md`
- `agent-5-output/gate-summary.json`
- `agent-5-output/chat-delivery/final-screenshot-delivery.md`
- corresponding `gate-results/*.json`
- an open local pre-deploy approval review in `human-review-events.jsonl`

Repair loop behavior:

- A failing ordinary QA gate enters a repair loop before asking the user.
- Each gate can be repaired up to five times.
- Each attempt logs the failure reason and repair task in `agent-5-output/repair-log.md`.
- The repair task must change real artifacts and then rerun the same gate.
- The repair loop must not hand-edit `gate-results/*.json`, lower gate standards, write fake PASS markdown, or skip gates.

Failures suitable for automatic repair:

- build failures
- missing page-plan routes
- missing tool-spec behavior
- rendered asset failures
- CSS or layout issues
- visual lock or similarity failures
- missing final QA evidence

Failures that require stopping or user input:

- requested changes to the product/SPEC direction
- requiring the user to choose a new UI option
- approved provider unavailable
- missing Cloudflare, GSC, or Bing credentials
- any gate still failing after five repair attempts

Failure behavior:

- Outside the QA state, it returns `QA_STAGE_REQUIRED`.
- Missing `site/` returns `SITE_MISSING`.
- Missing Agent3/Agent4 implementation outputs returns `IMPLEMENT_OUTPUT_MISSING`.
- Missing Agent2 outputs returns `AGENT2_OUTPUT_MISSING`.
- Missing selected-assets manifest returns `SELECTED_ASSETS_MISSING`.
- If a gate still fails after the repair limit, it keeps `stage: "qa"` and writes `blocking_reason: "QA_REPAIR_LIMIT_REACHED"`.

Success behavior:

- QA reports and gate summaries are complete.
- QA gates pass.
- `check-gates --before agent-6` is run as a deployment preview; a remaining deployment approval requirement is expected at this boundary.
- `human-review-events.jsonl` receives an open `pre_deploy_approval` review with launch-readiness summary.
- `desktop-run-state.json` is updated with `stage: "deploy-review"`, `last_completed_stage: "qa"`, `next_action: "review launch readiness and run desktop:continue with pre-deploy approval"`, and `blocking_reason: "pre-deploy-approval"`.
- It does not call Cloudflare.
- It does not submit sitemap.
- It does not run GSC or Bing.
- It does not deploy.

## Human Review Points

Desktop mode uses local files and terminal output:

- `spec-confirmation`: user replies `确认 SPEC` or `修改：...`
- `agent25_option_selection`: user chooses `A`, `B`, `C`, or replies `重做：...`
- `pre_deploy_approval` / `pre-deploy-approval`: user replies `确认部署` or `修改：...`

All review state is appended to `human-review-events.jsonl`. Existing events are immutable; resolution is recorded by appending a new event.

## Pre-Deploy Approval

`desktop:deploy` must block unless a resolved `pre_deploy_approval` or `pre-deploy-approval` event exists with `resolution_text: "确认部署"`.

This repository must not deploy from unapproved desktop state. A production launch also requires the project approval artifact described by `docs/production-run-master-contract.md`.

## Gate Repair Loop

Ordinary gate failures should enter a repair loop before asking the user. The loop may retry a gate up to five times. Each attempt must repair real artifacts and rerun the gate. It must not edit `gate-results/*.json`, lower gate standards, write markdown as fake PASS evidence, or skip gates.

If the standalone gate repair loop limit is exceeded, it blocks with `NEEDS_HUMAN_DECISION`. If the QA runner repair limit is exceeded, it keeps `stage: "qa"`, writes `blocking_reason: "QA_REPAIR_LIMIT_REACHED"`, and reports the gate name, failure reason, attempts, and the decision needed.

## Deprecated / Removed Remote Extension

The old Telegram / Hermes / remote worker flow is not an active feature in this repository.

Removed active commands include `remote:toolsite-worker`, `run:toolsite`, `continue:human-review`, `send:agent25-option-review`, `pre-agent2:telegram-loop`, and `read:hermes-intake`.

Removed active runtime files include `scripts/run/remote-toolsite-worker.mjs`, `scripts/run/run-toolsite-orchestrator.mjs`, `scripts/run/continue-human-review.mjs`, `scripts/run/read-hermes-intake.mjs`, `scripts/run/send-agent25-option-review.mjs`, and `scripts/run/pre-agent2-telegram-loop.mjs`.

Future remote operation must be redesigned outside the current desktop-first main flow before it can return as an active feature.
