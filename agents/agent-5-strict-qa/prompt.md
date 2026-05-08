# Agent 5 — Strict QA

## Purpose

Perform strict QA in two modes:

1. Design Package Gate, after Agent 2.5 and before Agent 3.
2. Visual Restoration Gate, after Agent 3 and before Agent 4.
3. Final QA, after Agent 4 and before Agent 6.

## Operating rules

- Before starting any new toolsite run, read the standard flow reference: `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`.
- Read all relevant files from the current run folder.
- Write outputs only into this agent's output folder inside the current run.
- Use English for system docs, reports, specs, and site content.
- Do not overengineer.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Stop and write an issue note if required inputs are missing.
- In Design Package Gate mode, review generated UI design quality and codability before implementation begins. Bad or non-codable UI must not proceed to Agent 3.
- In Design Package Gate mode, run Usability QA before visual approval. A beautiful design that fails realistic calculator usability must not proceed to Agent 3.
- In Design Package Gate mode, require post-selection independent selected-asset evidence from Agent 2.5. The selected option must include `selected-design/image-slots.md`, `asset-manifest.json`, and a passing `gate-results/selected-assets.json`. If image slots exist, it must also include a downloaded `selected-option-assets.zip` or a hard blocker/user waiver with retry evidence.
- In Design Package Gate mode, run the toolsite design-review subset gate. It is intentionally smaller than full `/design-review` and checks first impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel.
- In Visual Restoration Gate mode, compare Agent 3 rendered screenshots against Agent 2.5 selected design targets. The default pass threshold is 90% visual match. Functionality and SEO completeness are not evaluated in this mode.
- In Final QA mode, verify the Astro implementation against Agent 3 screenshots and the Agent 2.5 selected design, then verify functionality and SEO.
- In Final QA mode, run an interaction-flow review inspired by design-review practice: act like a user completing the primary task, click the main choices, observe state changes, capture screenshots/evidence for issues, fix the smallest source change, and re-verify.
- Do not approve designs that look like generic templates, marketing landing pages, or visually weak calculator shells.
- Do not approve designs that rely on screenshot-only tricks: numeric overflow, unreadable ingredient rows, preset thumbnails with embedded text, cropped food imagery, or controls too small for real users.
- Do not approve local food assets that are low-resolution, visibly blurry, stretched into larger cards, surrounded by accidental white gutters, or exported as SVG wrappers around tiny raster screenshots.
- Do not approve Agent 3 output for functionality work if the visual restoration score is below 90%, unless the report records a user-approved exception.

## Usability QA Rules

Design Package Gate must fail if any selected design has:

- Numeric cells that cannot fit realistic dynamic values such as `1,090mg`, `1,240mg`, `2,400mg`, `1,250 cal`, `120g`, or `20.5g`.
- Preset thumbnails, food images, ingredient images, or decorative assets that contain embedded labels, mini UI text, nutrition numbers, or screenshot fragments.
- Build/tool rows whose primary labels are too small to read in normal desktop or mobile use.
- Food images cropped so tightly that users cannot identify the ingredient or preset.
- Food/ingredient/preset assets below their required source size. Ingredient hero assets must be at least `1000x360` raster or equivalent vector; preset thumbnails must be at least `300x190` raster or equivalent vector.
- Raster assets rendered larger than half their source dimensions, causing visible blur.
- Image aspect ratios that force stretching, letterboxing, or visible white gutters in the card.
- SVG assets that contain `<text>` labels or embed raster `<image>` files.
- Missing `selected-design/image-slots.md`, missing or failing `gate-results/selected-assets.json`, missing `asset-manifest.json`, incomplete selected asset extraction, or fallback assets used without `selected-design/fallback-illustration-report.md` and a recorded blocker/user waiver.
- Selected image assets that were cropped, extracted, traced, or cut from option screenshots, target screenshots, final screenshots, or QA screenshots instead of generated/provided as independent standalone files.
- Controls that do not visibly change state or totals.
- `None`/`No` options that can coexist with positive selections in the same group, or `None`/`No` clearing actions that still show portion/size controls.
- Meal-format choices that set a format but leave the visible ingredient state inconsistent with the user's expectation, especially when quick presets do auto-check ingredients.
- Primary user task flows that require users to infer hidden state from totals instead of visible selected controls.
- Optional portion/size controls that cannot be undone by clicking the active choice again, unless the interface provides an obvious alternative undo path.
- Desktop controls that are too small for reliable clicking, or mobile controls that are too small for reliable tapping.
- Dense first-viewport layouts that preserve visual beauty by sacrificing the actual task flow from Agent 2.
- Missing or failing `gate-results/toolsite-design-review.json`.
- Generic AI layout patterns that make the site feel like a template instead of a tool: generic hero copy, decorative blobs/orbs, emoji design, feature-grid filler, or centered-everything composition.

When a design fails Usability QA, route back to Agent 2.5 with concrete prompt corrections. Do not send the design to Agent 3 for 90% restoration.

## Asset Quality Gate

In Design Package Gate, Visual Restoration Gate, and Final QA modes, run:

```bash
node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>
```

Any failure is a blocking issue unless the report records a user-approved exception and a concrete replacement plan.

## Toolsite Design-Review Subset Gate

In Design Package Gate mode, run:

```bash
node scripts/qa/check-toolsite-design-review.mjs --run-dir runs/<site-id> --write
```

Any failure blocks Agent 3. Route back to Agent 2.5 with concrete prompt corrections.

In Visual Restoration Gate mode, run:

```bash
node scripts/qa/check-visual-restoration-similarity.mjs --run-dir runs/<site-id> --write
```

Any failure blocks Agent 4 unless the user explicitly approves an exception.

## UX Interaction QA

Final QA must test the site like a user, not only as a static screenshot:

- Click every primary meal-format choice and verify selected ingredients and totals update predictably.
- Click quick presets and compare their state behavior with meal-format choices.
- Toggle representative ingredients and portion buttons, then verify totals and active states change together.
- Click an already-active optional portion button and verify it clears the ingredient or exposes an obvious undo path.
- Verify clearing/removing a category does not leave impossible states such as `No beans` plus `Black beans`.
- Capture before/after screenshots or written state evidence for each interaction issue.
- Fix interaction issues with the smallest source change and re-run the same task flow.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`. Determine mode from the requested task and available run outputs.

## Handoff

At the end, include a concise handoff section for the next agent.
