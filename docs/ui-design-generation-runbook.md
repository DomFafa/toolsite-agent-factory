# UI Design Generation Runbook

## Purpose

Every site must pass through GPT-powered UI design generation before implementation. User references are optional; design generation is mandatory.

Default visual restoration target: 90%.

The pipeline optimizes UI restoration before functionality and SEO. A site must not proceed to tool-function implementation until the selected design has been statically restored and passed the 90% Visual Restoration Gate.

## Standard Flow

1. Agent 2 writes product, SEO, content, tool specs, `ui-reference-dossier.md`, and `design-generation-input.md`.
2. Agent 2.5 builds `design-generation-prompt.md`.
3. Agent 2.5 uses `web-access` to submit the prompt and any allowed reference assets to the ChatGPT web UI or another approved design generation surface.
4. Agent 2.5 tells the external model that the design must be restored by Codex in Astro with HTML/CSS/vanilla JS and should be designed for 90% screenshot fidelity.
5. Agent 2.5 requests at least three UI directions. Each direction must include desktop/mobile design targets, design tokens, component specs, an asset plan, restoration rules, forbidden deviations, and runnable frontend code when possible.
6. Agent 2.5 downloads or extracts any original/generated PNG/SVG assets needed for faithful restoration.
7. Agent 2.5 imports any downloaded code archive with `scripts/design/import-generated-ui.mjs`.
8. Agent 2.5 runs each option locally when complete code is available and captures desktop/mobile screenshots.
9. Agent 2.5 selects one option and writes `design-manifest.md`.
10. Agent 5 runs in Design Package Gate mode. Agent 3 cannot start until this gate passes.
11. Agent 3 builds a static visual restoration prototype only. It must not implement calculator functionality or SEO content yet.
12. Agent 3 captures desktop/mobile screenshots and writes a visual diff report.
13. Agent 5 runs in Visual Restoration Gate mode. Agent 4 cannot start until the rendered screenshots match the selected design targets at 90% or higher.
14. Agent 4 adds functionality and SEO after the visual restoration gate passes, while preserving the visual lock.

## Reference Modes

`reference-guided` mode is used when the user provides reference sites, screenshots, illustrations, components, or interaction examples.

`open-exploration` mode is used when no references are provided. It still requires external design generation and at least three distinct directions.

## External LLM Safety

Never send:

- `.env.local`
- Cloudflare tokens
- account IDs not needed for design
- destination emails
- private credentials
- unpublished user personal data

The design model may adjust UI hierarchy and interaction layout, but Agent 2 remains the source of truth for product requirements, SEO targets, and content intent.

## Codable Design Prompt Requirements

Agent 2.5 must tell the external model:

- The output will be implemented in Astro with HTML, CSS, and vanilla JS.
- The default restoration target is 90% visual similarity.
- Prefer reproducible HTML/CSS/SVG/local-asset visuals over one-off image-model effects.
- Do not generate complex photorealism, random textures, 3D objects, uncertain fonts, text-as-image effects, heavy glassmorphism, or reflections unless those elements are exported as local assets.
- Keep key text as real text, not part of images.
- Reserve locations for SEO sections, but do not make SEO content part of the first visual-restoration task.
- The first viewport must be the usable tool.

## Allowed Visual Assets

Local generated PNG/SVG assets are allowed when they improve restoration fidelity.

Required asset rules:

- Assets must be original/generated or user-provided with permission.
- Assets must not include official logos, official product images, protected illustrations, or reference-site trade dress.
- Assets must be stored under the run folder and listed in `asset-plan.md`.
- Agent 3 may use these assets to reach the 90% visual target.

## Importing Downloaded Code

When ChatGPT produces a zip archive, import it with:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip ~/Downloads/<generated-ui>.zip \
  --option option-a
```

Use `--select` only for the approved option:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip ~/Downloads/<generated-ui>.zip \
  --option option-b \
  --select
```

The script validates zip paths before extraction and writes into:

```txt
runs/<site-id>/agent-2-5-output/generated-designs/<option>/code/
runs/<site-id>/agent-2-5-output/selected-design/code/
```

## Design Package Gate

Agent 5 Design Package Gate must fail if:

- no desktop/mobile design targets exist
- design tokens, component specs, asset plan, restoration rules, or forbidden deviations are missing
- the selected design is not practical for 90% restoration in Astro + HTML/CSS/vanilla JS
- first viewport is a marketing page instead of the tool
- mobile layout is unusable
- the result looks generic or template-like
- protected assets, logos, exact layouts, or reference copy are copied

## Visual Restoration Gate

Agent 5 Visual Restoration Gate must fail if:

- Agent 3 screenshots are missing
- Agent 3 visual diff report is missing
- Agent 3 implemented functionality or SEO before visual lock
- desktop visual match is below 90%
- mobile visual match is below 90%
- major visual modules drift from the selected design target
- required local assets are missing or replaced with low-fidelity placeholders without approval
