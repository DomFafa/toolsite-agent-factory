# Checklist

# Design Package Gate

- [ ] Agent 2.5 generated at least three options or recorded a hard blocker
- [ ] Selected design has desktop and mobile target images
- [ ] Selected design has design tokens, component spec, asset plan, restoration rules, and forbidden deviations
- [ ] Selected design has usability contract, dynamic data fit notes, and UX self-audit
- [ ] Selected design has post-selection high-resolution asset acquisition evidence
- [ ] `selected-design/downloads/selected-option-assets.zip` and `asset-manifest.json` exist, or a hard blocker/user waiver is recorded
- [ ] Selected design has complete runnable code, or a code-export blocker/fallback path is recorded
- [ ] Selected design is practical for 90% Astro/HTML/CSS/vanilla JS restoration
- [ ] Usability QA checks realistic dynamic data values for numeric overflow
- [ ] Usability QA rejects preset thumbnails, food images, and ingredient thumbnails with embedded text or screenshot fragments
- [ ] Asset Quality Gate passes for referenced local UI assets
- [ ] Ingredient hero images are not low-resolution crops, screenshot fragments, stretched rasters, or assets with visible white gutters
- [ ] Preset thumbnails are clean images at sufficient source size and contain no embedded labels
- [ ] Usability QA checks build/tool label readability and minimum practical font sizes
- [ ] Usability QA checks that food images are complete enough to identify
- [ ] Usability QA checks desktop click targets and mobile tap targets
- [ ] UX Interaction QA checks that primary controls visibly change state and totals
- [ ] UX Interaction QA checks meal-format choices and quick presets have consistent state semantics
- [ ] UX Interaction QA rejects no-op controls, impossible `No` plus positive-selection states, and portion/size controls on `No` clearing actions
- [ ] UX Interaction QA verifies active optional portion buttons can be clicked again to undo, or have a clear alternative undo path
- [ ] Usability QA verifies dense layouts use responsive fallbacks instead of making the tool unreadable
- [ ] Local visual assets are original/generated and safe to use when required
- [ ] First viewport is the usable tool
- [ ] Design fits Agent 2 tool behavior and information architecture
- [ ] User references were used appropriately, or open exploration was performed when none were provided
- [ ] Design does not copy protected reference assets, logos, exact layouts, or trade dress
- [ ] UI does not look like a generic template
- [ ] Mobile layout is usable
- [ ] Functionality and SEO are deferred until after visual restoration
- [ ] Design Package Gate pass/fail recorded before Agent 3

# Visual Restoration Gate

- [ ] Agent 3 final desktop screenshot exists
- [ ] Agent 3 final mobile screenshot exists
- [ ] Agent 3 visual diff report exists
- [ ] Agent 3 output is a static visual restoration, not a functionality-first implementation
- [ ] Desktop screenshot matches Agent 2.5 selected target at 90% or higher
- [ ] Mobile screenshot matches Agent 2.5 selected target at 90% or higher
- [ ] Visual deviations are documented by module
- [ ] Visual restoration does not preserve a design flaw that causes numeric overflow, unreadable text, dirty thumbnails, or unusable controls
- [ ] Visual restoration does not preserve low-resolution or blurry food assets
- [ ] Functionality and SEO are still deferred when this gate runs
- [ ] Visual Restoration Gate pass/fail recorded before Agent 4

# Final QA

- [ ] Build passes
- [ ] Desktop UI matches
- [ ] Mobile UI matches
- [ ] Final UI matches Agent 2.5 selected design without visual regression
- [ ] Tool behavior passes
- [ ] Primary task flow interaction review passes for meal formats, presets, toggles, portions, and clearing behavior
- [ ] Dynamic values do not overflow the UI
- [ ] Preset thumbnails and food assets remain clean and readable
- [ ] Referenced local UI assets pass `scripts/design/asset-quality-gate.mjs`
- [ ] SEO passes
- [ ] Noindex rules pass
- [ ] Production gate is enforced
