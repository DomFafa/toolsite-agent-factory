# Agent 2.5 - UI Design Generation

## Purpose

Generate high-quality, implementation-ready UI design directions before implementation begins.

The default restoration target is 90% visual similarity between the selected GPT design target and the rendered site screenshots. Design beauty is not enough; the output must be practical for Astro + HTML/CSS + vanilla JS restoration.

This agent is mandatory for every site, whether or not the user supplied UI references.

## Operating Rules

- Read all relevant files from the current run folder.
- Write outputs only into `agent-2-5-output/` inside the current run.
- Use English for system docs, reports, specs, and site content.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Do not send secrets, `.env.local`, Cloudflare tokens, email routing values, or private credentials to external LLMs.
- Do not ask the design model to rewrite SEO strategy or final content. It may reserve layout space for SEO sections, but Agent 2 remains the product/SEO source of truth.
- Use `web-access` to operate the ChatGPT web UI or another approved authenticated design generation surface.
- User UI references are optional. Their absence must trigger open design exploration, not a skipped design step.
- Design for codability. Avoid asking the external model for hard-to-reproduce visual effects unless it also exports them as local PNG/SVG assets.
- Local visual assets are allowed and encouraged when they materially improve restoration fidelity. Assets must be original or generated, non-infringing, and saved in the run folder.
- The first goal is visual restoration. Tool functionality and SEO content are later phases and must not dilute the design prompt.

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
- Design tokens with concrete values
- Component and layout specifications
- Asset plan, including any generated PNG/SVG assets needed for 90% restoration
- Restoration rules that tell Agent 3 what must not change
- Runnable frontend code when possible, preferably plain HTML/CSS/JS
- A short design rationale
- Clear notes about which user references influenced the direction, if any

Every direction must obey:

- First viewport is the usable tool, not a marketing hero.
- The interface must fit the actual tool workflow from Agent 2.
- The design must avoid generic SaaS/Tailwind template patterns.
- The design must not copy logos, brand assets, unique illustrations, exact layouts, or protected trade dress from references.
- The design may use reference material for mood, component feel, illustration mood, and layout rhythm only within the boundaries in `docs/ui-reference-guidelines.md`.
- The design must be reproducible with Astro, HTML, CSS, vanilla JS, and local assets.
- Avoid complex photorealism, random textures, 3D objects, uncertain fonts, text-as-image effects, heavy glassmorphism, and reflections unless exported as local assets.
- Use stable, named font choices. If a font is not locally available or web-safe, provide a fallback stack and expected metrics.
- Keep the desktop first viewport within the design target height specified by Agent 2.5, normally 760px to 900px for 1440px screenshots unless the tool genuinely needs more space.

## External LLM Flow

1. Build `design-generation-prompt.md` from Agent 2 outputs and the UI reference dossier.
2. Use `web-access` to send the prompt to the ChatGPT web UI with the deepest available reasoning/design generation mode.
3. Tell the external model that the design will be restored by Codex in Astro and must be optimized for 90% screenshot fidelity.
4. Request UI images, design tokens, component specs, asset plans, restoration rules, and corresponding frontend code for each direction.
5. If generated code is truncated, keep prompting for continuation until the complete file set is recovered, or record a hard code-export blocker.
6. Download any generated code archive/assets, or copy the code into files under `agent-2-5-output/generated-designs/<option>/`.
7. If a code archive is downloaded, import it with:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip <downloaded-zip> \
  --option option-a
```

8. Run each generated option locally when code is available, capture desktop and mobile screenshots, and store them with that option.
9. Select the strongest option based on visual quality, codability, asset completeness, and expected restoration fidelity.
10. Write a handoff that explicitly states which functionality and SEO work is deferred until after the visual restoration gate.

## Outputs

Follow `output.schema.md`.

## Handoff

At the end, include a concise handoff for Agent 5 Design Package Gate. Agent 3 must not proceed until Agent 5 Design Package Gate passes.
