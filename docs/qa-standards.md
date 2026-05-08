# QA Standards

Standard flow reference: before starting any new toolsite run, Codex must read `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`.

## Design Package Gate checks

Agent 5 must run once after Agent 2.5 and before Agent 3. It must check:

- Agent 2.5 generated at least three design options or recorded a hard external blocker
- Selected design has desktop and mobile target screenshots
- Selected design has design tokens, component spec, asset plan, restoration rules, and forbidden deviations
- Selected design has usability contract, interaction state model, dynamic data fit notes, and UX self-audit
- Selected design has post-selection independent selected-asset evidence, including `selected-design/image-slots.md`, `asset-manifest.json`, and passing `gate-results/selected-assets.json`
- `gate-results/toolsite-design-review.json` passes the toolsite design-review subset
- When selected image slots exist, `selected-option-assets.zip` exists unless a hard blocker or user-approved waiver is recorded
- Selected image assets are independent standalone GPT/generated/user-provided files, not crops, extracts, traces, or cut-outs from option screenshots, target screenshots, final screenshots, or QA screenshots
- Selected design has complete runnable frontend code, or the code-export blocker/fallback path is clearly recorded
- Selected design is practical for 90% restoration in Astro + HTML/CSS + vanilla JS
- Usability QA passes before visual approval:
  - realistic dynamic values do not overflow metric/result cells
  - preset thumbnails and food images do not contain embedded text or screenshot fragments
  - food/ingredient images meet asset-quality requirements for source size, aspect ratio, subject fill, and white-margin risk
  - SVG assets do not contain `<text>` labels or embed low-resolution raster `<image>` files
  - build/tool labels are readable
  - controls are large enough for click/tap use
  - food images are not cropped beyond recognition
  - dense layouts use responsive fallbacks rather than shrinking the actual workflow
  - primary controls visibly change selected state, calculated results, or both
  - no-op choices are removed or converted into clear mutually exclusive clearing actions
  - `No` clearing actions do not display portion/size controls
  - mutually exclusive states cannot coexist, such as `No beans` selected alongside `Black beans`
  - meal-format choices and quick presets use consistent, predictable state semantics
  - optional active portion/size buttons can be clicked again to undo, or the design provides an obvious alternative undo path
- Required local visual assets are present and safe to use
- Required local visual assets pass `node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>`
- First viewport is the usable tool, not a marketing hero
- First impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel gates pass
- UI fits Agent 2 tool behavior and information architecture
- User references were used appropriately, or open exploration was performed when none were provided
- Design does not copy protected reference assets, logos, exact layouts, trade dress, or copywriting
- UI does not look like a generic template
- Mobile layout is usable

Agent 3 cannot start until Design Package Gate passes.

## Visual Restoration Gate checks

Agent 5 must run after Agent 3 and before Agent 4. It must check:

- Agent 3 desktop screenshot exists
- Agent 3 mobile screenshot exists
- Agent 3 visual diff report exists
- Agent 3 output is still a static visual restoration, not a functionality-first implementation
- `gate-results/visual-restoration-similarity.json` passes at 90% or higher
- Desktop screenshot matches Agent 2.5 selected design target at 90% or higher
- Mobile screenshot matches Agent 2.5 selected design target at 90% or higher
- Major modules match the selected design target: first viewport, typography, spacing, cards, controls, visual assets, background, and mobile structure
- The restoration does not preserve or introduce usability defects: numeric overflow, unreadable text, dirty thumbnails, broken food crops, or unusable controls
- The restoration does not preserve or introduce low-resolution, blurry, stretched, or white-gutter food assets
- Functionality and SEO remain deferred until after the gate

Agent 4 cannot start until Visual Restoration Gate passes.

## Final QA checks

Agent 5 must run again after Agent 4. It must check:

- `npm install` succeeds
- `npm run build` succeeds
- No console errors for normal interaction
- Desktop screenshot exists
- Mobile screenshot exists
- Actual implementation matches Agent 2.5 selected design
- Actual implementation matches Agent 3 screenshots
- `gate-results/toolsite-design-review.json` still passes
- `gate-results/visual-restoration-similarity.json` still passes
- Tool works with normal and edge-case inputs
- Primary task-flow interaction review passes for meal-format choices, quick presets, ingredient toggles, portion buttons, and clearing behavior
- Primary controls visibly update the selected state and calculated totals
- Mutually exclusive choices cannot coexist after any normal interaction
- `No` clearing actions have no portion/size controls and cancel themselves when a positive option in the same group is selected
- Active optional portion/size buttons can be clicked again to clear that ingredient, or an obvious alternative undo path exists
- Meal-format choices and quick presets keep visible ingredient selections consistent with the calculated totals
- Dynamic output values such as `1,090mg`, `1,240mg`, `2,400mg`, `1,250 cal`, `120g`, and `20.5g` fit without overflow
- Preset thumbnails, food images, and ingredient thumbnails are clean images without embedded text
- `gate-results/selected-assets.json` still passes
- Referenced local UI assets pass the asset quality gate
- Title and meta description are keyword aligned
- Canonical URL is correct
- Robots and sitemap are correct
- Development is noindex
- Production index switch is gated by approval
- FAQ schema is valid when FAQ exists
- Page is usable on mobile
- Basic accessibility passes keyboard and contrast sanity checks

## Visual QA rule

Agent 5 Final QA must compare:

```txt
agent-2-5-output/selected-design/
agent-3-output/final-screenshots/
```

against the actual Astro implementation rendered in browser.

The implementation must not drift from Agent 3 UI.

Agent 5 Final QA must also perform an interaction-flow review. It must click through the main user task flow, capture screenshot or written state evidence for before/after behavior, make the smallest fix for any interaction defect, and re-run the same flow after the fix.
