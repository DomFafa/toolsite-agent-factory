# Agent 2.5 - UI Design Generation

## Purpose

Generate high-quality UI design directions and runnable frontend code before implementation begins.

This agent is mandatory for every site, whether or not the user supplied UI references.

## Operating Rules

- Read all relevant files from the current run folder.
- Write outputs only into `agent-2-5-output/` inside the current run.
- Use English for system docs, reports, specs, and site content.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Do not send secrets, `.env.local`, Cloudflare tokens, email routing values, or private credentials to external LLMs.
- Do not ask the design model to rewrite SEO strategy or final content. It may arrange and style content, but Agent 2 remains the product/SEO source of truth.
- Use `web-access` to operate the ChatGPT web UI or another approved authenticated design generation surface.
- User UI references are optional. Their absence must trigger open design exploration, not a skipped design step.

## Required Inputs

- `agent-2-output/site-brief.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/content-plan.md`
- `agent-2-output/seo-plan.md`
- `agent-2-output/ui-reference-dossier.md`
- Any referenced screenshots/assets in the run folder

## Design Generation Requirements

Generate at least three distinct UI directions unless a hard external blocker prevents generation.

Each direction must include:

- Desktop design target
- Mobile design target
- Runnable frontend code, preferably plain HTML/CSS/JS
- A short design rationale
- Clear notes about which user references influenced the direction, if any

Every direction must obey:

- First viewport is the usable tool, not a marketing hero.
- The interface must fit the actual tool workflow from Agent 2.
- The design must avoid generic SaaS/Tailwind template patterns.
- The design must not copy logos, brand assets, unique illustrations, exact layouts, or protected trade dress from references.
- The design may use reference material for mood, component feel, illustration mood, and layout rhythm only within the boundaries in `docs/ui-reference-guidelines.md`.

## External LLM Flow

1. Build `design-generation-prompt.md` from Agent 2 outputs and the UI reference dossier.
2. Use `web-access` to send the prompt to the ChatGPT web UI with the deepest available reasoning/design generation mode.
3. Request UI images and corresponding frontend code for each direction.
4. Download any generated code archive, or copy the code into files under `agent-2-5-output/generated-designs/<option>/`.
5. If a code archive is downloaded, import it with:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip <downloaded-zip> \
  --option option-a
```

6. Run each generated option locally, capture desktop and mobile screenshots, and store them with that option.
7. Select the strongest option only after it has runnable code and browser screenshots.

## Outputs

Follow `output.schema.md`.

## Handoff

At the end, include a concise handoff for Agent 5 Design Gate. Agent 3 must not proceed until Agent 5 Design Gate passes.
