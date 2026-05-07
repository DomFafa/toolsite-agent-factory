# Usability Gate Report

Mode: Test run against the current Chipotle restored UI after adding the new Agent 2.5/Agent 5 usability rules.

## Verdict

Fail under the new Design Package Gate.

This is expected. The current UI was optimized for 90% visual restoration before the usability-first constraints were added, so it is useful as a regression fixture for the new gate.

## Evidence

Rendered screenshots:

- `agent-5-output/qa-screenshots/usability-gate-desktop.png`
- `agent-5-output/qa-screenshots/usability-gate-mobile.png`

Commands:

- `npm run build`
- `npx playwright screenshot --viewport-size=1440,900 http://127.0.0.1:4323/ runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/usability-gate-desktop.png`
- `npx playwright screenshot --viewport-size=390,1000 http://127.0.0.1:4323/ runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/usability-gate-mobile.png`

## Gate Findings

1. Build/tool label readability fails.
   - Evidence: `site/src/styles/global.css` sets desktop item labels to `font-size: 9px`.
   - New gate expectation: primary build labels should target at least 12px on desktop and 14px on mobile.

2. Build food image usability is weak.
   - Evidence: `site/src/styles/global.css` sets `.panel-photo` height to `52px` on desktop.
   - New gate expectation: food imagery must keep the primary subject identifiable and should not be compressed just to preserve first-screen density.

3. Quick preset thumbnails require rejection or regeneration.
   - Evidence: current preset assets are 86x58 cropped mock fragments under `site/public/ui-assets/preset-*.png`.
   - New gate expectation: preset thumbnails must be clean food-only images. Names, nutrition values, labels, and UI text must be rendered as HTML, not embedded in tiny images.

4. Numeric overflow remains a mandatory stress check.
   - The current screenshot does not show the same sodium overflow after the latest width adjustments, but the new gate explicitly requires stress values such as `1,090mg`, `1,240mg`, and `2,400mg` to fit before approval.

## Required Agent 2.5 Prompt Correction

The next design prompt must tell the external model:

- Do not design a pretty static board by shrinking the actual task controls.
- Reserve room for realistic nutrition values and long ingredient names.
- Use clean food images for presets and render all preset text as HTML.
- Use responsive fallback layouts when six-column desktop cards make labels or images too small.

## Handoff

This test confirms the new gate catches the exact defects observed during the 90% restoration trial. The next Chipotle UI regeneration should start from Agent 2.5 with these usability constraints, then Agent 5 should approve the design package only after these findings are resolved.
