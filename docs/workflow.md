# Toolsite Workflow

Production run behavior is governed by `docs/production-run-master-contract.md`. If this workflow conflicts with the contract, the contract wins.

Desktop-first is the current and only active product workflow. New users should start with `docs/desktop-first-flow.md` and the `desktop:*` package scripts.

## Active Flow Summary

1. `desktop:intake` creates a desktop production run from the five required inputs and optional local image assets.
2. `desktop:pre-agent2` writes `toolsite-spec.md` and opens a local SPEC confirmation event.
3. `desktop:continue` resolves the SPEC confirmation in `human-review-events.jsonl`.
4. `desktop:agent2` writes Agent2 outputs and runs the Pre-Agent2 SPEC, Page Plan, and Agent2 compliance gates.
5. `desktop:agent25` is the next state for UI A/B/C generation.
6. Agent2.5 uses the external action executor, evidence runner, and proof gate split.
7. `desktop:select-ui` or `desktop:continue` records local UI option selection.
8. `desktop:implement`, `desktop:qa`, and `desktop:deploy` continue the local state machine as their real runners are wired.
9. `desktop:deploy` must block until pre-deploy approval is recorded.

## Local Human Review Events

Human review is local and append-only. The canonical file is:

```txt
runs/<site-id>/human-review-events.jsonl
```

Required fields are `schema_version`, `type`, `review_type`, `id`, `site_id`, `run_dir`, `phase`, `agent`, `status`, `blocking`, `blocks`, `title`, `message`, `expected_reply`, `attachments`, `created_at`, and `created_by`. Attachment paths are relative to the run directory.

Active local review types:

- `spec-confirmation`
- `ui-option-selection`
- `pre-deploy-approval`

Review resolution is also append-only. Do not edit old events in place.

## SPEC Confirmation

The confirmed SPEC is the first human-facing contract before Agent2. The SPEC must be specific to the current tool and must pass `npm run test:pre-agent2-spec` coverage.

The SPEC review card must be local-user-facing and Chinese-first. It may keep necessary product terms such as `word counter`, `Stripe`, `wordcounter.net`, metric names, and URL paths, but it must not forward whole English sentences from `toolsite-spec.md` as the review content when a clear Chinese summary is available.

Agent2 is blocked until:

- `toolsite-spec.md` exists.
- `human-review-events.jsonl` contains a resolved SPEC confirmation.
- `gate-results/pre-agent2-toolsite-spec.json` passes.

## Agent2

Agent2 reads the confirmed SPEC and writes:

- `agent-2-output/site-brief.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/content-plan.md`
- `agent-2-output/seo-plan.md`
- `agent-2-output/page-plan.md`
- `agent-2-output/ui-reference-dossier.md`
- `agent-2-output/design-generation-input.md`
- `agent-2-output/brief-compliance-summary.md`

Agent2 must not introduce unapproved pages, login, account systems, dashboards, pricing, APIs, file upload, saved history, or AI rewrite features.

## Agent2.5 External Design Proof

Agent2.5 design-options work uses three separate responsibilities:

- Executor: `scripts/run/execute-agent25-design-options.mjs` performs the real browser/CDP/web-access external action.
- Evidence runner: `scripts/run/run-agent25-external-action.mjs` records already captured evidence, writes `agent-2-5-output/external-design-evidence/action-receipt.json`, and computes hashes.
- Gate: `scripts/run/check-agent25-external-design-proof.mjs` validates receipt, artifacts, proof, hashes, and lineage.

The evidence runner is not a browser automation runner. The gate is not an evidence writer. The executor does not deploy and does not implement selected-assets.

## UI A/B/C Selection

Agent2.5 must produce three reviewable UI options and a local option board under `agent-2-5-output/chat-delivery/`.

The active local selection path is:

```bash
npm run desktop:select-ui -- --run-dir runs/<site-id> --option A
```

or:

```bash
npm run desktop:continue -- --run-dir runs/<site-id> --review ui-option-selection --reply A
```

The selected option must be recorded in `human-review-events.jsonl` before implementation.

## Pre-Deploy Approval

Deployment is blocked until both are true:

- A resolved `pre-deploy-approval` event exists in `human-review-events.jsonl`.
- `runs/<site-id>/approval.md` satisfies the launch approval contract.

This repository must not deploy during planning, testing, Agent2.5 design selection, or QA repair loops.

## Gate / Repair Loop

Gates are machine-readable blockers. A failed gate must be repaired by changing real source artifacts, then rerunning the gate. Do not edit gate JSON to force a pass.

Repair loop rules:

- Retry a specific gate at most five times.
- Record the gate name, failure, attempt count, and repaired files.
- Stop with `NEEDS_HUMAN_DECISION` when the repair loop cannot make progress.
- Never skip a required gate to keep the workflow moving.

## Deprecated / Removed Remote Extension

The old Telegram / Hermes / remote worker flow has been removed from active product runtime.

Removed active commands include `remote:toolsite-worker`, `run:toolsite`, `continue:human-review`, `send:agent25-option-review`, `pre-agent2:telegram-loop`, and `read:hermes-intake`.

Removed active runtime files include `scripts/run/remote-toolsite-worker.mjs`, `scripts/run/run-toolsite-orchestrator.mjs`, `scripts/run/continue-human-review.mjs`, `scripts/run/read-hermes-intake.mjs`, `scripts/run/send-agent25-option-review.mjs`, and `scripts/run/pre-agent2-telegram-loop.mjs`.

Historical remote-operation assumptions must not be used to make current product decisions. Future remote operation requires a new design and new active implementation.
