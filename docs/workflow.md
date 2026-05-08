# Workflow

Standard flow reference: before starting any new toolsite run, Codex must read `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`.

## Phase 0: Prepare run folder

Create a run folder using:

```bash
./scripts/create-run.sh <site-id> <domain>
```

Example:

```bash
./scripts/create-run.sh keyword-density-checker keyworddensitychecker.com
```

## Phase 1: Keyword research

Use Agent 1 only when keyword validation is needed. Agent 1 stops after producing a keyword research report. It does not launch Agent 2.

## Phase 2: Build brief

Agent 2 receives:

- Primary keyword
- Target domain
- Brief requirements
- Optional UI reference objects

It produces product, SEO, content, tool specs, and a UI reference dossier for Agent 2.5.

## Phase 2.5: UI design generation

Before Agent 2.5 starts, run `node scripts/run/check-web-access.mjs --run-dir runs/<site-id> --write`. The pipeline is blocked unless the repo-local `web-access/` skill files and relative script paths pass this preflight.

Agent 2.5 uses `web-access` to generate UI design directions and implementation-ready design packages through the ChatGPT web UI or another approved design generation surface.

This step is mandatory even when no UI references are provided.

The default restoration target is 90%. Agent 2.5 must request codable and usable UI output: target screenshots, design tokens, component specs, usability contract, interaction-state model, dynamic data fit notes, UX self-audit, asset plans, asset-quality contract, restoration rules, forbidden deviations, and frontend code when available.

After the winning option is selected, Agent 2.5 must inventory every selected-design image slot in `selected-design/image-slots.md`. If there are no image slots, both `image-slots.md` and `asset-manifest.json` must explicitly say so. If image slots exist, Agent 2.5 must continue the external GPT/design-model interaction and request independent standalone image assets for each slot. Cropping, extracting, tracing, or cutting assets from option screenshots, target screenshots, final screenshots, or QA screenshots is forbidden.

The asset request prompt must be saved as `selected-design/asset-generation-prompt.md`. The resulting `selected-option-assets.zip`, `asset-manifest.json`, extracted assets, retry evidence, and any fallback/waiver must be recorded before Design Package Gate. Run `node scripts/qa/check-selected-assets.mjs --run-dir runs/<site-id> --write`; `gate-results/selected-assets.json` must pass before Agent 3 can start.

## Phase 2.6: Design Package Gate

Agent 5 runs in Design Package Gate mode. It reviews the selected design package before implementation and runs Usability QA before visual approval. It must verify interaction state semantics, post-selection independent selected-asset evidence, `gate-results/selected-assets.json`, and the executable asset quality gate.

Agent 5 must also run the toolsite design-review subset gate: `node scripts/qa/check-toolsite-design-review.mjs --run-dir runs/<site-id> --write`. This is not the full `/design-review` workflow; it mechanically checks the parts that matter for tool sites: first impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel. `gate-results/toolsite-design-review.json` must pass before Agent 3 can start.

## Phase 3: Static visual restoration

Agent 3 creates a static visual restoration prototype from the approved design package, runs it locally, and captures desktop/mobile screenshots from the actual rendered page.

Agent 3 must not implement calculator functionality, SEO sections, FAQ, schema, sitemap, production indexing, or deployment. The only goal is to make the rendered screenshots match the selected design target at 90% or higher.

## Phase 3.5: Visual Restoration Gate

Agent 5 runs in Visual Restoration Gate mode. It compares Agent 3 rendered screenshots against the Agent 2.5 selected design target.

Agent 4 cannot start until desktop and mobile visual match scores are at least 90%, unless the user explicitly approves an exception. The mechanical screenshot comparison is `node scripts/qa/check-visual-restoration-similarity.mjs --run-dir runs/<site-id> --write`; `gate-results/visual-restoration-similarity.json` must pass before Agent 4 can start.

The 90% visual match gate does not override usability. If a selected design creates numeric overflow, unreadable build rows, dirty thumbnails, cropped food images, no-op controls, `No` clearing actions with portion/size controls, impossible mutually exclusive states, meal-format behavior that conflicts with quick presets, or unusable controls, Agent 5 must route back to Agent 2.5 instead of approving restoration.

## Phase 4: Astro implementation

Agent 4 implements the site in Astro using Agent 3 output. It must not redesign the approved UI.

Functionality is added after the visual gate. SEO metadata, SEO content sections, FAQ, schema, sitemap, and robots logic are added after the visual gate and must not disturb the visual lock.

## Phase 5: QA

Agent 5 runs again in Final QA mode and checks:

- Desktop UI screenshot vs actual implementation
- Mobile UI screenshot vs actual implementation
- Agent 2.5 selected design vs actual implementation
- SEO metadata
- Structured data
- Tool behavior
- Primary task-flow interaction behavior
- Accessibility basics
- Build success
- Noindex/index rules
- Sitemap/robots rules
- Content quality

## Phase 6: Production launch

Agent 6 runs only after:

- Agent 5 Final QA passed
- `approval.md` is completed
- Cloudflare zone is active
- Domain nameservers already point to Cloudflare

Agent 6 produces a complete launch report.
