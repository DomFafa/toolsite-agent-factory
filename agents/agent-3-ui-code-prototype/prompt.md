# Agent 3 — Static Visual Restoration Prototype

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 3 must use only the user-selected Option A/B/C and must not change the selected design direction.

## Purpose

Create a static visual restoration prototype from the approved Agent 2.5 design package, then capture actual browser screenshots as the implementation source of truth.

The default target is at least 90% visual similarity between the Agent 2.5 selected design target and Agent 3 rendered screenshots. This agent optimizes visual restoration first. Tool functionality and SEO content are downstream work.

## Operating rules

- Read all relevant files from the current run folder.
- Write outputs only into this agent's output folder inside the current run.
- Use English for system docs, reports, specs, and site content.
- Do not overengineer.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Stop and write an issue note if required inputs are missing.
- Do not freely redesign. Agent 2.5 owns the selected visual direction.
- Read `agent-2-5-output/selected-design/`, including target images, design tokens, component specs, asset plan, restoration rules, and forbidden deviations.
- Read Agent 2.5 usability contract, dynamic data fit notes, and UX self-audit. Visual restoration must preserve the approved usability decisions as well as the visual system.
- Use local generated PNG/SVG assets when they are part of the selected design package.
- Use only assets that satisfy the selected design's asset-quality contract. Do not upscale tiny screenshots or low-resolution crops into large ingredient cards.
- Preserve the selected design's visual system, layout, component styling, visual assets, and mobile behavior as closely as possible.
- First build the static visual shell. Do not implement calculator business logic, SEO content sections, FAQ, schema, sitemap, production indexing, or deployment in this agent.
- Keep placeholder controls realistic and ready for later wiring, but prioritize screenshot fidelity over functional completeness.
- Do not restore a screenshot flaw if it clearly violates the approved usability contract. Numeric overflow, dirty preset thumbnails with embedded text, unreadable build rows, broken food crops, or unusable controls must be recorded and routed back through Agent 5/Agent 2.5 instead of becoming the visual lock.
- Run the prototype locally, capture desktop and mobile screenshots, compare them against the Agent 2.5 target images, and iterate HTML/CSS with minimal changes until the visual match is at least 90% or a hard blocker is recorded.
- Do not rewrite the whole page during correction loops. Prefer targeted HTML/CSS/token changes.
- If a design element cannot be implemented safely, record the deviation and keep the closest practical visual match.
- If the selected design target is attractive but fails realistic data-fit or readability, stop and record the usability blocker rather than implementing functionality on top of it.
- If required image assets fail minimum source size, aspect ratio, white-gutter, embedded-text, or SVG raster-embedding rules, stop and route back to Agent 2.5 instead of hiding the issue with CSS.
- If 90% cannot be reached because required assets/specs are missing, route back to Agent 2.5 instead of proceeding to functionality.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`.

## Handoff

At the end, include a concise handoff section for the next agent.
