# Production Run Master Contract

This contract defines the current production workflow for the toolsite agent factory.

Current product decision: desktop-first is the only active production workflow in this repository. Remote operation has been removed from active runtime. Future remote operation requires a new design and implementation before it can re-enter the main flow.

## Current Product Target

The production target is a lightweight, static, SEO-oriented, visually distinctive tool site generated through local desktop orchestration and deployed only after explicit approval.

Every production run must preserve:

- Tool-first first viewport.
- Static frontend by default.
- No login, account, dashboard, pricing, database, backend, API key, upload, saved history, or AI rewrite unless the user explicitly approves that scope.
- Local human review through `human-review-events.jsonl`.
- Confirmed Toolsite SPEC before Agent2.
- UI A/B/C selection before implementation.
- Pre-deploy approval before deployment.
- Machine-readable gates and repair loops.

## Active Desktop Commands

The active product entrypoints are:

- `desktop:intake`
- `desktop:pre-agent2`
- `desktop:agent2`
- `desktop:agent25`
- `desktop:select-ui`
- `desktop:implement`
- `desktop:qa`
- `desktop:deploy`
- `desktop:run`
- `desktop:continue`

These commands operate on local files under `runs/<site-id>/` and must not require off-machine control channels.

## Run State

Every production run must include:

```txt
runs/<site-id>/
  input.md
  run-meta.json
  input-assets/
  toolsite-spec.md
  agent-2-output/
  agent-2-5-output/
  agent-3-output/
  agent-4-output/
  agent-5-output/
  agent-6-output/
  site/
  gate-results/
  deployment-output/
  human-review-events.jsonl
  desktop-run-state.json
```

`run-meta.json` must record `run_type: "production"`, `deployable: true`, `mode: "desktop"`, `site_id`, `target_domain`, `created_at`, and `status`.

Generated production run output under `runs/` must not be committed unless the user explicitly asks for a fixture or artifact.

## Local Human Review Contract

`human-review-events.jsonl` is the local review log. It is append-only.

Active review types:

- `spec-confirmation`
- `ui-option-selection`
- `pre-deploy-approval`

Codex must pause at each blocking review point. Resolution must be recorded by appending a new event with the resolved status and reply text. Do not mutate old review events in place.

## SPEC Contract

Pre-Agent2 must produce `toolsite-spec.md` before Agent2 starts.

The SPEC must include:

- The five required user inputs: keyword, target domain, UI reference, UX reference, and extra ideas / constraints / mimic points.
- Lightweight Q&A record fields.
- Tool Purpose.
- Target Users and Use Cases.
- First Viewport UX.
- Input / Output Model.
- Result Experience.
- UI / UX Direction.
- Non-goals.
- Technical Constraints.
- Page Boundary.
- SEO Baseline.
- Success Criteria Baseline.

The SPEC must not include internal workflow terms as user-facing requirements. Agent2 is blocked until the local SPEC confirmation is resolved and the Pre-Agent2 SPEC gate passes.

## Agent2 Contract

Agent2 must treat the confirmed Toolsite SPEC as the fact source.

Required outputs:

- `site-brief.md`
- `tool-spec.md`
- `content-plan.md`
- `seo-plan.md`
- `page-plan.md`
- `ui-reference-dossier.md`
- `design-generation-input.md`
- `brief-compliance-summary.md`

Required gates before Agent2.5:

- `pre-agent2-toolsite-spec`
- `page-plan`
- `agent2-brief-compliance`

Agent2 must not add unapproved pages or features. Agent2 must stop before Agent2.5 once the state reaches `agent25`.

## Agent2.5 External Action Evidence

Agent2.5 design-options execution is split into three responsibilities:

- Executor: `scripts/run/execute-agent25-design-options.mjs` performs the real browser/CDP/web-access external action.
- Evidence runner: `scripts/run/run-agent25-external-action.mjs` signs already captured evidence, writes `agent-2-5-output/external-design-evidence/action-receipt.json`, and computes hashes.
- Gate: `scripts/run/check-agent25-external-design-proof.mjs` validates receipt, artifacts, proof, hashes, and lineage.

The executor owns external browser action only. The evidence runner does not operate the browser. The gate does not write receipts or fabricate evidence.

Agent2.5 design-options must not implement selected-assets. Selected-assets remains a later post-selection asset acquisition gate, not part of the design-options executor.

## UI A/B/C Selection

Agent2.5 must produce reviewable Option A, Option B, and Option C images plus a local option board.

The current active user decision is local:

- Open a `ui-option-selection` event in `human-review-events.jsonl`.
- Attach or reference `agent-2-5-output/chat-delivery/options-board.png`.
- Record user choice `A`, `B`, `C`, or `重做：...` through `desktop:continue` or `desktop:select-ui`.

Implementation is blocked until UI option selection is resolved.

## Gate / Repair Loop

Gates are blockers, not suggestions.

Rules:

- Fix real artifacts, then rerun gates.
- Do not edit gate JSON into a pass state.
- Do not weaken gate standards to make a run pass.
- Retry a failing gate at most five times before stopping for a human decision.
- Record evidence for each gate and repair attempt.

## Deployment Contract

Deployment is blocked until:

- All required gates pass.
- A resolved local `pre-deploy-approval` event exists.
- `runs/<site-id>/approval.md` exists and satisfies the launch approval checklist.

No deployment may occur from Agent2.5 design generation, UI option selection, implementation, QA repair, or unapproved desktop state.

## Repository Safety Contract

Never commit:

- `runs/`
- `.env` or `.env.*`
- `node_modules/`
- runtime logs
- screenshots, zips, or temporary generated artifacts unless explicitly approved as test fixtures
- secrets, tokens, API keys, private credentials, or private browser/session state

Do not modify external repositories as part of the desktop-first flow.

## Deprecated / Removed Remote Extension

The old Telegram / Hermes / remote worker flow is not an active feature in this repository.

Removed active commands include `remote:toolsite-worker`, `run:toolsite`, `continue:human-review`, `send:agent25-option-review`, `pre-agent2:telegram-loop`, and `read:hermes-intake`.

Removed active runtime files include `scripts/run/remote-toolsite-worker.mjs`, `scripts/run/run-toolsite-orchestrator.mjs`, `scripts/run/continue-human-review.mjs`, `scripts/run/read-hermes-intake.mjs`, `scripts/run/send-agent25-option-review.mjs`, and `scripts/run/pre-agent2-telegram-loop.mjs`.

This section is historical only. It must not be read as current support for Telegram, Hermes, toolsite-inbox, mobile-controlled runs, remote workers, or remote operation.
