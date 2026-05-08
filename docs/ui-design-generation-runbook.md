# UI Design Generation Runbook

## Purpose

Every site must pass through GPT-powered UI design generation before implementation. User references are optional; design generation is mandatory.

Default visual restoration target: 90%.

The pipeline optimizes usable UI restoration before functionality and SEO. A site must not proceed to tool-function implementation until the selected design has passed the usability-first Design Package Gate, then has been statically restored and passed the 90% Visual Restoration Gate.

## Standard Flow

1. Agent 2 writes product, SEO, content, tool specs, `ui-reference-dossier.md`, and `design-generation-input.md`.
2. Agent 2.5 builds `design-generation-prompt.md`.
3. Agent 2.5 cannot start until `node scripts/run/check-web-access.mjs --run-dir runs/<site-id> --write` passes against the repo-local `web-access/` skill.
4. Agent 2.5 uses `web-access` to submit the prompt and any allowed reference assets to the ChatGPT web UI or another approved design generation surface.
   Agent 2.5 must preserve raw external provenance under `agent-2-5-output/external-design-evidence/`: the external response, a conversation screenshot/export, and a source-provenance map from the external response to the selected target screenshots/code.
5. Agent 2.5 tells the external model that the design must be restored by Codex in Astro with HTML/CSS/vanilla JS and should be designed for 90% screenshot fidelity.
6. Agent 2.5 gives the external model the real tool workflow, interaction state semantics, realistic dynamic data ranges, overflow stress values, long labels, and click/tap constraints before asking for visuals.
7. Agent 2.5 requests at least three UI directions. Each direction must include desktop/mobile design targets, design tokens, component specs, usability contract, interaction state model, dynamic data fit notes, UX self-audit, an asset plan, restoration rules, forbidden deviations, and runnable frontend code when possible.
8. Agent 2.5 downloads or extracts any original/generated PNG/SVG assets needed for faithful restoration.
9. Agent 2.5 writes `asset-quality-contract.md` for every image slot, including rendered size, required source size, aspect ratio, subject fill, white-margin risk, file path, and raster/vector type.
10. Agent 2.5 imports any downloaded code archive with `scripts/design/import-generated-ui.mjs`.
11. Agent 2.5 runs each option locally when complete code is available and captures desktop/mobile screenshots.
12. Agent 2.5 sends one comparison image containing all three GPT-generated options to the current chat and stops for user selection.
    If the user does not respond within 3 minutes, Agent 2.5 may select the GPT-recommended option by timeout.
    The option board and decision must be saved under `agent-2-5-output/chat-delivery/`.
13. Agent 2.5 selects one option and writes `design-manifest.md`.
14. Agent 2.5 continues interacting with the external design model after option selection and requests `selected-option-assets.zip` for every image slot in the selected design.
15. Agent 2.5 downloads the high-resolution asset zip, extracts assets into `agent-2-5-output/selected-design/assets/`, preserves the zip in `agent-2-5-output/selected-design/downloads/`, and writes `asset-acquisition-report.md`.
16. Agent 5 runs in Design Package Gate mode with Usability QA first, including the asset quality gate and post-selection asset acquisition evidence. Agent 3 cannot start until this gate passes.
17. Agent 3 builds a static visual restoration prototype only. It must not implement calculator functionality or SEO content yet.
18. Agent 3 captures desktop/mobile screenshots and writes a visual diff report.
19. Agent 5 runs in Visual Restoration Gate mode. Agent 4 cannot start until the rendered screenshots match the selected design targets at 90% or higher.
20. Agent 4 adds functionality and SEO after the visual restoration gate passes, while preserving the visual lock.
21. Agent 5 captures final implementation screenshots, runs the final target-vs-page visual similarity gate at 90% or higher, and sends both the GPT target image and the final coded page screenshot to the current chat before production approval.

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
- Do not put text inside preset thumbnails, food photos, ingredient thumbnails, or decorative images.
- Do not use low-resolution crops or screenshot fragments for food imagery. Ingredient hero assets must be at least `1000x360` raster or equivalent SVG/vector, and preset thumbnails must be at least `300x190` raster or equivalent SVG/vector.
- Avoid visible white gutters inside image files. Subject fill should usually be `75%-92%` of the visual area.
- Reserve room for realistic dynamic values such as `1,090mg`, `1,240mg`, `2,400mg`, `1,250 cal`, `120g`, and `20.5g`.
- Keep build/tool labels readable and controls clickable. If six columns make the tool too small, use a 3x2 grid, tabs, accordion, horizontal grouping, or another responsive fallback.
- Define interaction state semantics before visualizing controls. Primary controls must visibly affect selected state, calculated results, or both.
- Do not include no-op or zero-effect choices unless they are clearly modeled as mutually exclusive clearing actions without portion/size controls.
- Mutually exclusive states must not be able to coexist. A `No beans` style action cannot stay selected alongside a positive beans choice.
- Meal-format choices, quick presets, ingredient toggles, portion buttons, and clearing actions must use consistent, predictable state transitions.
- Reserve locations for SEO sections, but do not make SEO content part of the first visual-restoration task.
- The first viewport must be the usable tool.

## Chat Option Selection Gate

Agent 2.5 must not silently select a design. It must:

- Assemble a single comparison image with Option A, Option B, and Option C.
- Send that comparison image to the current chat window.
- Ask the user to choose one option.
- Wait up to 3 minutes.
- If the user replies, select the user's option.
- If the user does not reply within 3 minutes, select GPT's recommended option.
- Save `agent-2-5-output/chat-delivery/options-board.png`.
- Save `agent-2-5-output/chat-delivery/option-selection.md` with `Decision: PASS`, all option names, whether the board was sent to chat, and whether the selected option came from the user or the 3-minute default.

Agent 3 is blocked until this record exists and passes the mechanical gate.

## Allowed Visual Assets

Local generated PNG/SVG assets are allowed when they improve restoration fidelity.

Required asset rules:

- Assets must be original/generated or user-provided with permission.
- Assets must not include official logos, official product images, protected illustrations, or reference-site trade dress.
- Assets must be stored under the run folder and listed in `asset-plan.md`.
- Assets must be listed in `asset-quality-contract.md` with source dimensions, intended rendered dimensions, aspect ratio, subject fill notes, and white-margin risk.
- Raster assets must be at least 2x the rendered slot in both dimensions. Ingredient hero raster assets must be at least `1000x360`; preset thumbnail raster assets must be at least `300x190`.
- SVG assets must be true vector artwork. They must not contain `<text>` labels or embed raster `<image>` files.
- Agent 3 may use these assets to reach the 90% visual target.

Run the executable gate after assets are wired:

```bash
node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>
```

## Post-Selection Asset Pack

After Agent 2.5 selects the winning option, it must not proceed directly to Agent 5. It must use `web-access` to continue the ChatGPT/design-model conversation and request a high-resolution asset pack for the selected option.

The required download is:

```txt
agent-2-5-output/selected-design/downloads/selected-option-assets.zip
```

The zip must include:

- `asset-manifest.json`
- `asset-quality-contract.md`
- one original/generated image file per selected-design image slot
- optional `asset-prompts.md`

The asset request must tell the model:

- Do not crop assets from the design screenshot.
- Generate or export each image slot as a standalone production asset.
- Match the selected option's visual style.
- Keep all labels and nutrition values out of image files.
- Provide ingredient hero images at least `1000x360`, preset thumbnails at least `300x190`, and any larger rendered slot at 2x source pixels.
- Avoid visible white gutters, watermarking, logos, and screenshot fragments.

If the zip is missing, incomplete, low-resolution, or fails `asset-quality-gate`, Agent 2.5 must return to the external model with the exact failures and request a corrected zip. Fallback vector/local placeholders are allowed only after repeated failure or explicit user waiver, and must be recorded in `asset-acquisition-report.md`.

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
- raw external GPT/design-model provenance is missing, including `external-design-evidence/external-response.md`, `conversation-screenshot.png`, and `source-provenance.md`
- the selected target screenshots/code cannot be traced back to the external design response
- design tokens, component specs, asset plan, restoration rules, or forbidden deviations are missing
- usability contract, dynamic data fit notes, or UX self-audit are missing
- interaction state model is missing or does not cover primary task-flow controls
- post-selection high-resolution asset acquisition evidence is missing, unless a hard external blocker or user-approved waiver is recorded
- the selected design is not practical for 90% restoration in Astro + HTML/CSS/vanilla JS
- first viewport is a marketing page instead of the tool
- mobile layout is unusable
- numeric values can overflow metric cards or result cells
- preset thumbnails, food images, or ingredient images contain embedded text or screenshot fragments
- food images are low-resolution, blurry, stretched into large cards, surrounded by accidental white gutters, or exported as SVG wrappers around tiny raster screenshots
- build/tool rows are too small to read or controls are too small to click/tap
- primary controls are no-ops, `No` clearing actions show portion/size controls, mutually exclusive states can coexist, or meal-format choices behave inconsistently with quick presets
- food imagery is cropped so tightly that users cannot understand it
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
- referenced local UI assets fail `scripts/design/asset-quality-gate.mjs`

## Final Chat Delivery Gate

Before production approval, Agent 5 must send the final comparison evidence to the current chat:

- GPT/Agent 2.5 selected target screenshot.
- Final coded page screenshot after Agent 4 implementation.

The delivery must be recorded in `agent-5-output/chat-delivery/final-screenshot-delivery.md` with `Decision: PASS`. Agent 6 is blocked until this record exists.

## Final Visual Similarity Gate

Before Agent 6, Agent 5 must compare the GPT/Agent 2.5 selected target screenshots against the final coded page screenshots:

- desktop target vs final desktop page must be at least 90% similar
- mobile target vs final mobile page must be at least 90% similar
- the gate must write `gate-results/final-visual-similarity.json`

Agent 6 is blocked if this gate is missing or failing.
