# Asset Quality Gate Report

## Scope

Added and executed the local UI asset quality gate for the Chipotle Nutrition Calculator run.

## Gate Rules Added

- Ingredient hero assets must be at least `1000x360` raster or equivalent SVG/vector.
- Preset thumbnail assets must be at least `300x190` raster or equivalent SVG/vector.
- Referenced SVG assets must not contain `<text>` labels.
- Referenced SVG assets must not embed raster `<image>` files.
- Referenced assets must fit role-specific aspect ratio ranges.

## Current Site Fix

- Replaced referenced `group-*` food card assets with `1200x440` SVG illustrations.
- Replaced referenced `preset-*` thumbnail assets with `360x240` SVG illustrations.
- Kept labels and nutrition values as HTML text, not image text.

## Evidence

- Asset gate desktop screenshot: `runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/asset-gate-desktop.png`
- Asset gate mobile screenshot: `runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/asset-gate-mobile.png`
- Asset gate mobile full-page screenshot: `runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/asset-gate-mobile-fullpage.png`

## Validation

- `npm run asset-quality -- --run-dir runs/chipotle-nutrition-calculator`
- `npm run test:asset-quality`
- `npm run test:ui-ux-gates`
- `npm run test:ui-import`
- `npm run test:indexnow`
- `npm run build` from `runs/chipotle-nutrition-calculator/site`

## Result

Passed. The referenced local UI assets now satisfy the executable asset quality gate.
