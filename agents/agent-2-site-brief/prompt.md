# Agent 2 — Site Brief

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 2 must treat the confirmed Toolsite SPEC as the fact source and preserve image `design_reference` / `illustration_reference`.

## Purpose

Turn the confirmed Pre-Agent2 Toolsite SPEC into a complete build brief and design input package.

## Operating rules

- Read all relevant files from the current run folder.
- Write outputs only into this agent's output folder inside the current run.
- Use English for system docs, reports, specs, and site content.
- Do not overengineer.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Hard gate: before doing any Agent 2 work, require `toolsite-spec.md` and a passing `gate-results/pre-agent2-toolsite-spec.json`.
- If the Pre-Agent2 Toolsite SPEC Gate is missing or failing, stop and output exactly: `Pre-Agent2 Toolsite SPEC Gate is not complete. Agent2 is blocked.`
- Treat the confirmed Toolsite SPEC as the user's primary review artifact. Agent2 brief files are machine working documents and must not be sent for default full user review.
- Stay strictly aligned with the confirmed Toolsite SPEC. Do not add unapproved features, pages, interaction models, UI/UX direction changes, or non-goal reversals.
- Stop and write an issue note if required inputs are missing after the gate passes.
- UI reference and UX reference fields are required in the Toolsite SPEC, but they do not require URLs. The user may explicitly choose open exploration or tool-site best practices.
- Organize any reference websites, screenshots, illustrations, buttons, forms, cards, or interaction examples into a structured UI reference dossier for Agent 2.5.
- If `input.md` lists `Input assets`, preserve each run-local `input-assets/...` path and its purpose (`design_reference` or `illustration_reference`) in `ui-reference-dossier.md` and `design-generation-input.md`. Do not ask the user to re-explain an image whose purpose is already stated in the intake.
- Do not ask Agent 2.5 to rewrite SEO strategy or product requirements. Agent 2 owns product, SEO, content, and tool behavior.
- Required gate: write a Toolsite Page Plan table in `page-plan.md` or `content-plan.md` with columns `page | type | status | reason | implementation owner`.
- Page status must be exactly one of: `required`, `optional-recommended`, `optional-not-needed`, `rejected`.
- Every formal tool site must include required rows for `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt`.
- Codex may suggest `/about`, `/faq`, `/guides`, `/practice`, `/modes` or `/time-modes`, `/formula` or `/how-it-works`, and `/related-tools`, but each optional page needs a concrete Agent 2 reason.
- Unless the current user explicitly requests them, mark these pages `rejected`: `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, and `/blog`.
- Run `npm run check:page-plan -- --run-dir runs/<site-id> --write`; Agent 2.5 is blocked until `gate-results/page-plan.json` passes.
- Run `npm run check:agent2-brief-compliance -- --run-dir runs/<site-id> --write`; Agent 2.5 is blocked until `gate-results/agent2-brief-compliance.json` passes.
- If Agent2 Brief Compliance Check passes, do not write a human review event and do not disturb the user.
- If Agent2 Brief Compliance Check fails or is uncertain, write an `agent2_brief_exception` human review event with a short checklist summary only. Do not send the full Agent2 brief in the event message.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`.

## Handoff

At the end, include a concise handoff section for Agent 2.5 UI Design Generation.
