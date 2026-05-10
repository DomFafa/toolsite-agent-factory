# Agent 2 — Site Brief

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
- Stop and write an issue note if required inputs are missing after the gate passes.
- UI reference and UX reference fields are required in the Toolsite SPEC, but they do not require URLs. The user may explicitly choose open exploration or tool-site best practices.
- Organize any reference websites, screenshots, illustrations, buttons, forms, cards, or interaction examples into a structured UI reference dossier for Agent 2.5.
- Do not ask Agent 2.5 to rewrite SEO strategy or product requirements. Agent 2 owns product, SEO, content, and tool behavior.
- Required gate: write a Toolsite Page Plan table in `page-plan.md` or `content-plan.md` with columns `page | type | status | reason | implementation owner`.
- Page status must be exactly one of: `required`, `optional-recommended`, `optional-not-needed`, `rejected`.
- Every formal tool site must include required rows for `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt`.
- Codex may suggest `/about`, `/faq`, `/guides`, `/practice`, `/modes` or `/time-modes`, `/formula` or `/how-it-works`, and `/related-tools`, but each optional page needs a concrete Agent 2 reason.
- Unless the current user explicitly requests them, mark these pages `rejected`: `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, and `/blog`.
- Run `npm run check:page-plan -- --run-dir runs/<site-id> --write`; Agent 2.5 is blocked until `gate-results/page-plan.json` passes.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`.

## Handoff

At the end, include a concise handoff section for Agent 2.5 UI Design Generation.
