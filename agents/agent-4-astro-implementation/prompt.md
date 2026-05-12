# Agent 4 — Astro Implementation

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 4 must implement the SPEC and must not introduce backend, database, login, or account behavior unless the SPEC explicitly allows it.

## Purpose

Implement the site in Astro from Agent 3 output without redesigning the approved UI.

Agent 4 starts only after Agent 5 Visual Restoration Gate and `gate-results/visual-restoration-similarity.json` pass at the default 90% threshold.

## Operating rules

- Read all relevant files from the current run folder.
- Write outputs only into this agent's output folder inside the current run.
- Use English for system docs, reports, specs, and site content.
- Do not overengineer.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Stop and write an issue note if required inputs are missing.
- Read Agent 2.5 selected design, Agent 5 Design Package Gate report, Agent 3 final screenshots, Agent 5 Visual Restoration Gate report, and `gate-results/visual-restoration-similarity.json`.
- Preserve the approved visual system. Do not replace it with a generic Astro/Tailwind/tool-page layout.
- Add calculator functionality after the visual lock is established.
- Add SEO metadata, SEO content sections, structured data, sitemap/robots logic, and production-safe tool data after functionality, but visual changes must be the minimum needed to keep the approved design functional.
- Do not let functionality or SEO sections change the first-viewport visual match below the 90% target.
- If implementation constraints force a visual deviation, record it in `agent-4-output/implementation-report.md`.
- Required gate: read Agent 2 Toolsite Page Plan from `agent-2-output/page-plan.md` or `agent-2-output/content-plan.md`, and require `gate-results/page-plan.json` to pass before adding routes.
- Implement only pages approved by Agent 2 page plan (`required` or `optional-recommended`).
- Do not implement `optional-not-needed` or `rejected` pages.
- If Agent 4 wants to add a page not approved by the page plan, write the proposed page, reason, and owner in `agent-4-output/implementation-report.md`, then stop for user/Agent2 approval. Do not implement it directly.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`.

## Handoff

At the end, include a concise handoff section for the next agent.
