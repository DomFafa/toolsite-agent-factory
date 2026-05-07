# Agent 3 — Static Visual Restoration Prototype

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
- Use local generated PNG/SVG assets when they are part of the selected design package.
- Preserve the selected design's visual system, layout, component styling, visual assets, and mobile behavior as closely as possible.
- First build the static visual shell. Do not implement calculator business logic, SEO content sections, FAQ, schema, sitemap, production indexing, or deployment in this agent.
- Keep placeholder controls realistic and ready for later wiring, but prioritize screenshot fidelity over functional completeness.
- Run the prototype locally, capture desktop and mobile screenshots, compare them against the Agent 2.5 target images, and iterate HTML/CSS with minimal changes until the visual match is at least 90% or a hard blocker is recorded.
- Do not rewrite the whole page during correction loops. Prefer targeted HTML/CSS/token changes.
- If a design element cannot be implemented safely, record the deviation and keep the closest practical visual match.
- If 90% cannot be reached because required assets/specs are missing, route back to Agent 2.5 instead of proceeding to functionality.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`.

## Handoff

At the end, include a concise handoff section for the next agent.
