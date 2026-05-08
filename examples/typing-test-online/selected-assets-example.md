# Selected Assets Example

## Purpose

Defines selected assets as an independent post-selection stage.

## Required Order

1. User selects GPT option, or timeout selects GPT recommendation.
2. Agent 2.5 writes `selected-design/image-slots.md`.
3. Agent 2.5 updates `selected-design/asset-manifest.json`.
4. Agent 2.5 writes `asset-acquisition-report.md`.
5. Run `check-selected-assets`.
6. Agent 5 Design Package Gate reviews the result.

## If Image Slots Exist

Required:

- Ask GPT/design model for standalone assets.
- Save `selected-design/asset-generation-prompt.md`.
- Download or record `selected-design/downloads/selected-option-assets.zip`.
- Extract assets into `selected-design/assets/`.
- Record retries and blockers.

Blocks:

- Cropping from `target/desktop.png`
- Cropping from `target/mobile.png`
- Cropping from option screenshots
- Cropping from final or QA screenshots
- Using low-resolution raster assets
- SVGs with embedded raster screenshots or text labels

## If No Image Slots Exist

Required evidence:

- `image-slots.md`: `Required image slots: none`
- `asset-manifest.json`: empty image slots
- `asset-acquisition-report.md`: no-assets decision

Block:

- Silent skip.

## Mechanical Gate

```bash
node scripts/qa/check-selected-assets.mjs --run-dir runs/<site-id> --write
```

Pass file:

```txt
gate-results/selected-assets.json
```

