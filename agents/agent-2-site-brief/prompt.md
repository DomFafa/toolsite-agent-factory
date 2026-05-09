# Agent 2 — Site Brief

## Purpose

Turn keyword, domain, requirements, and optional UI references into a complete build brief and design input package.

## Operating rules

- Read all relevant files from the current run folder.
- Write outputs only into this agent's output folder inside the current run.
- Use English for system docs, reports, specs, and site content.
- Do not overengineer.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Stop and write an issue note if required inputs are missing.
- UI references are optional, but the UI design generation step after Agent 2 is mandatory.
- If no references are provided, write an open-exploration design input instead of skipping design preparation.
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
