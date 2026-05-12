# Agent 2.5 - UI Design Generation

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 2.5 final A/B/C options must come from an approved high-fidelity visual generation path; wireframes, markdown boards, or Codex mockups are internal drafts only, and unavailable generation must return `NO_APPROVED_UI_GENERATION_AVAILABLE`.

## Purpose

Generate high-quality, implementation-ready UI design directions before implementation begins.

The default restoration target is 90% visual similarity between the selected GPT design target and the rendered site screenshots. Design beauty is not enough; the output must be practical for Astro + HTML/CSS + vanilla JS restoration and must pass usability constraints before restoration begins.

This agent is mandatory for every site, whether or not the user supplied UI references.

## Operating Rules

- Before starting any new toolsite run, read the standard flow reference: `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`.
- Before doing work, output a run-start acknowledgement: flow files read, current run phase, next agent to execute, and actions forbidden in the current phase.
- Read all relevant files from the current run folder.
- Write outputs only into `agent-2-5-output/` inside the current run.
- Use English for system docs, reports, specs, and site content.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Do not send secrets, `.env.local`, Cloudflare tokens, email routing values, or private credentials to external LLMs.
- Do not ask the design model to rewrite SEO strategy or final content. It may reserve layout space for SEO sections, but Agent 2 remains the product/SEO source of truth.
- Use `web-access` to operate the ChatGPT web UI or another approved authenticated design generation surface.
- External GPT source proof is mandatory. Agent 2.5 must prove the three UI options, option board, selected targets, and selected design package came from GPT or an approved external design surface, not Codex local HTML/CSS, manual mockups, reconstructed screenshots, or locally generated targets.
- User UI references are optional. Their absence must trigger open design exploration, not a skipped design step.
- Design for codability. Avoid asking the external model for hard-to-reproduce visual effects unless it also exports them as local PNG/SVG assets.
- Local visual assets are allowed and encouraged when they materially improve restoration fidelity. Assets must be original or generated, non-infringing, and saved in the run folder.
- Large food/ingredient imagery must be designed as production assets, not cropped from screenshots. Each image slot must specify final display size, required source size, aspect ratio, subject fill, and white-margin limits before approval.
- The first goal is visual restoration. Tool functionality and SEO content are later phases and must not dilute the design prompt.
- The selected design must be a usable calculator interface, not only a polished static image. Realistic dynamic data, long labels, state changes, and touch targets must fit before the design can proceed.
- The design must include interaction semantics for the real user task flow. Main choices, presets, empty states, and clearing actions must visibly update state and results in predictable ways.
- Do not put text inside food photos, preset thumbnails, ingredient thumbnails, chart images, or decorative assets. Thumbnail images must be clean visual assets; labels, nutrition numbers, and UI copy must be rendered as real HTML text.
- Selecting an option is not the end of Agent 2.5. After the selected option is confirmed, Agent 2.5 must continue interacting with the external design model until it obtains a high-resolution asset pack for every image slot in the selected design, or records a hard blocker with exact retry evidence.
- UI option selection must be visual. Before writing an open `agent25-option-selection` human review event, Agent 2.5 must create `agent-2-5-output/chat-delivery/options-board.png` as a real reviewable image containing Option A, Option B, and Option C. Text summaries, markdown files, image paths, option-summary files, or a local HTML board without an exported image are not sufficient.
- The `agent25-option-selection` human review event must attach `agent-2-5-output/chat-delivery/options-board.png` with `kind: "image"`. The message may explain the choices, but it cannot replace the image.
- If `options-board.png` is missing or not a real image, Agent 2.5 must stop and output exactly: `Agent2.5 UI Option Selection is blocked because no reviewable UI images were generated.` It must not write a resolved option selection, must not enter Agent 3, and must not treat pure text Option A/B/C descriptions as formal UI review.

## Required Inputs

- `agent-2-output/site-brief.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/content-plan.md`
- `agent-2-output/seo-plan.md`
- `agent-2-output/ui-reference-dossier.md`
- Any referenced screenshots/assets in the run folder

## Design Generation Requirements

Generate at least three distinct UI directions unless a hard external blocker prevents generation.

The `design-generation-prompt.md` and external GPT prompt must include these non-negotiable constraints:

- The UI must be restorable in Astro + HTML/CSS + vanilla JS.
- The target is 90% screenshot similarity against the coded page.
- The first viewport must be the real usable tool, not a marketing page.
- Realistic dynamic data and long labels must not overflow.
- The mobile layout must be readable, tappable, and usable.
- Primary interaction states must be complete and visible.
- Pretty-but-unusable UI must be rejected.
- UX must not be sacrificed for visual impact.

Each direction must include:

- Desktop design target
- Mobile design target
- Design tokens with concrete values
- Component and layout specifications
- Asset plan, including any generated PNG/SVG assets needed for 90% restoration
- Usability contract covering realistic data ranges, overflow behavior, readable text sizes, and responsive fallbacks
- Dynamic data fit notes covering worst-case values and long labels
- Interaction state model covering primary task flows, starter defaults, clearing behavior, mutually exclusive choices, and controls that affect totals
- UX self-audit explaining how the design avoids pretty-but-unusable calculator states
- Restoration rules that tell Agent 3 what must not change
- Runnable frontend code when possible, preferably plain HTML/CSS/JS
- A short design rationale
- Clear notes about which user references influenced the direction, if any

Every direction must obey:

- First viewport is the usable tool, not a marketing hero.
- The interface must fit the actual tool workflow from Agent 2.
- The interface must fit realistic calculator data, not only the values in the mock screenshot.
- The design must avoid generic SaaS/Tailwind template patterns.
- The design must pass the toolsite design-review subset: first impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel.
- Avoid generic hero copy, decorative blobs/orbs, emoji design, feature-grid filler, centered-everything template composition, and SEO/marketing content above the actual tool.
- The design must not copy logos, brand assets, unique illustrations, exact layouts, or protected trade dress from references.
- The design may use reference material for mood, component feel, illustration mood, and layout rhythm only within the boundaries in `docs/ui-reference-guidelines.md`.
- The design must be reproducible with Astro, HTML, CSS, vanilla JS, and local assets.
- Avoid complex photorealism, random textures, 3D objects, uncertain fonts, text-as-image effects, heavy glassmorphism, and reflections unless exported as local assets.
- Use stable, named font choices. If a font is not locally available or web-safe, provide a fallback stack and expected metrics.
- Keep the desktop first viewport within the design target height specified by Agent 2.5, normally 760px to 900px for 1440px screenshots unless the tool genuinely needs more space.
- Numeric fields must reserve enough width for realistic long values, including examples such as `1,090mg`, `1,240mg`, `2,400mg`, `1,250 cal`, `120g`, and `20.5g`.
- Ingredient, preset, and option labels must remain readable with real menu names and localized long words. Minimum desktop body/control label target is 12px; minimum mobile label target is 14px unless the label is clearly secondary metadata.
- Interactive controls must be large enough to click or tap: target at least 32px on desktop and 44px on mobile where space permits.
- Do not include controls that have no visible or numeric effect. Zero-effect pseudo-options such as `No rice`, `No beans`, or `No protein` are allowed only when implemented as mutually exclusive clearing actions, cannot coexist with positive selections, and do not display portion/size controls.
- Meal format choices must have explicit state semantics. If a user selects a bowl, burrito, salad, tacos, or quesadilla format, the design must define whether it applies a sensible starter build, clears ingredients, or preserves current ingredients; the UI must communicate and support that behavior.
- Quick presets and primary meal-format actions must be audited together so they do not create inconsistent expectations. If presets auto-check ingredients, meal-format starter choices should also update the visible ingredient state or clearly explain why they do not.
- Optional portion/size controls must be reversible. When a user clicks the already-active portion on an optional ingredient, the expected behavior must either clear that ingredient or explicitly explain a different undo path.
- Food and ingredient images must show the food clearly. Do not crop the primary subject off the card. If six columns make the food or labels too small, choose a 3x2 layout, horizontal grouping, tabs, or another responsive fallback instead of squeezing the UI.
- Preset thumbnails must not contain embedded text, mini nutrition labels, tiny badges, or screenshot fragments. Use clean food-only images and place preset names/numbers beside them as HTML.
- Asset quality contract is mandatory for every local image asset:
  - Ingredient hero images must be original/generated assets at least `1000x360` for raster, or SVG/vector with an equivalent `viewBox`.
  - Preset thumbnails must be at least `300x190` for raster, or SVG/vector with an equivalent `viewBox`.
  - Raster source size must be at least 2x the rendered CSS slot in both dimensions.
  - Aspect ratio must match the intended slot closely enough to avoid stretching or visible white gutters.
  - Primary food subject should fill roughly `75%-92%` of the visual area without being cropped beyond recognition.
  - Avoid white/transparent edge padding larger than `8%` on any side unless the component intentionally provides that padding.
  - SVG assets must not contain `<text>` labels or embed low-resolution raster `<image>` files.

## Post-Selection High-Resolution Asset Acquisition

After selecting the winning option, Agent 2.5 must run a mandatory asset acquisition loop through `web-access` in the same external design surface:

1. Write `agent-2-5-output/selected-design/image-slots.md` listing every selected-design image slot, including purpose and intended rendered size. If there are no image slots, explicitly record `Required image slots: none` in `image-slots.md`, `asset-manifest.json`, and `asset-acquisition-report.md`.
2. If image slots exist, send the selected option name, selected target screenshot, component spec, image slot inventory, and `asset-quality-contract.md` back to the external model.
3. Ask the model to generate every image asset used by the selected design as separate high-resolution standalone files. These must be independent production assets, not crops, extracts, traces, or cut-outs from the design screenshot, option screenshots, target screenshots, final screenshots, or QA screenshots.
4. Save the exact post-selection asset request as `agent-2-5-output/selected-design/asset-generation-prompt.md`.
5. Require a downloadable `selected-option-assets.zip` containing:
   - `asset-manifest.json`
   - `asset-quality-contract.md`
   - one file per image slot, using stable names such as `ingredient-rice.png`, `preset-lean-chicken-bowl.png`, `hero-food.png`, or equivalent SVG names
   - optional source prompts in `asset-prompts.md`
6. Require every file in the zip to match the selected option's style and composition.
7. Require raster ingredient hero assets to be at least `1000x360`, raster preset thumbnails to be at least `300x190`, and any larger rendered slots to have at least 2x source pixels.
8. Require images to contain no embedded UI text, mini labels, nutrition values, logos, watermarks, screenshot fragments, or accidental white gutters.
9. Download the zip, import or extract the assets into `agent-2-5-output/selected-design/assets/`, and preserve the zip under `agent-2-5-output/selected-design/downloads/`.
10. Run `node scripts/qa/check-selected-assets.mjs --run-dir runs/<site-id> --write`. If the gate fails, return to the external model with the exact failures and request a corrected asset zip.
11. Run the asset quality gate after wiring those assets into the run. If the gate fails, return to the external model with the exact failures and request a corrected asset zip.
12. Repeat until the high-resolution asset pack passes, or record a hard external blocker in `asset-acquisition-report.md`.

Fallback generated illustrations, fallback vector art, or locally generated placeholders are allowed only after the asset acquisition loop fails or is explicitly waived by the user. They must be recorded in `asset-acquisition-report.md` and `selected-design/fallback-illustration-report.md` with `Decision: PASS`, not treated as the preferred path.

## External LLM Flow

1. Build `design-generation-prompt.md` from Agent 2 outputs and the UI reference dossier.
2. Use `web-access` to send the prompt to the ChatGPT web UI with the deepest available reasoning/design generation mode.
3. Tell the external model that the design will be restored by Codex in Astro and must be optimized for 90% screenshot fidelity.
4. Give the external model the actual tool workflow, expected inputs, dynamic output ranges, long-label examples, and state transition expectations from Agent 2. Tell it to design for real use before visual polish.
5. Request UI images, design tokens, component specs, usability contracts, dynamic data fit notes, UX self-audits, asset plans, restoration rules, and corresponding frontend code for each direction.
6. Explicitly ask the model to reject its own beautiful-but-unusable choices, including numeric overflow, tiny ingredient text, cropped food cards, preset thumbnails with embedded text, controls that do not affect state/results, inconsistent preset vs meal-format behavior, impossible mutually exclusive states, and mobile controls that cannot be tapped.
7. Require a per-option `asset-quality-contract.md` that lists every image slot, rendered CSS size, required source size, source file path, aspect ratio, subject fill notes, and whether the asset is raster or vector.
8. If generated code is truncated, keep prompting for continuation until the complete file set is recovered, or record a hard code-export blocker.
9. Download any generated code archive/assets, or copy the code into files under `agent-2-5-output/generated-designs/<option>/`.
10. If a code archive is downloaded, import it with:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip <downloaded-zip> \
  --option option-a
```

11. Run each generated option locally when code is available, capture desktop and mobile screenshots, and store them with that option.
12. Select the strongest option based on visual quality, codability, asset completeness, usability, real-data fit, and expected restoration fidelity.
13. Save source proof under `external-design-evidence/`: raw/exported GPT response, real conversation screenshot, source-provenance map, selected-design lineage, and `external-design-proof.json`.
14. Build `chat-delivery/options-board.png` from GPT option source images only. Do not use local HTML/CSS, manual mockups, reconstructed targets, or Codex-created option boards as formal evidence.
15. Write an open `agent25-option-selection` human review event whose attachments include `agent-2-5-output/chat-delivery/options-board.png` with `kind: "image"`.
16. Run `node scripts/run/check-agent25-option-images.mjs --run-dir runs/<site-id> --write`. If `gate-results/agent25-option-images.json` does not pass, stop with `Agent2.5 UI Option Selection is blocked because no reviewable UI images were generated.`
17. Stop for explicit user selection in the current chat. Formal projects do not allow the 3-minute default path; timeout default is allowed only for test/dry-run and must be recorded as such.
18. Run `node scripts/run/check-agent25-external-design-proof.mjs --run-dir runs/<site-id> --write`. Agent 3 is blocked until `gate-results/agent25-external-design-proof.json` passes.
19. After the selected option is confirmed, run the mandatory post-selection high-resolution asset acquisition loop and download `selected-option-assets.zip`.
20. Extract selected high-resolution assets into `agent-2-5-output/selected-design/assets/` and preserve the original zip in `agent-2-5-output/selected-design/downloads/`.
21. Run `node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>` when selected assets are wired into the run. Treat failures as design package blockers.
22. Write a handoff that explicitly states which functionality and SEO work is deferred until after the visual restoration gate.

## Outputs

Follow `output.schema.md`.

## Handoff

At the end, include a concise handoff for Agent 5 Design Package Gate. Agent 3 must not proceed until Agent 5 Design Package Gate passes.
