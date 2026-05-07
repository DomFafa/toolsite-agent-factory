# Design Scripts

Utilities for Agent 2.5 UI Design Generation.

## Import Generated UI

After ChatGPT or another approved design surface downloads a frontend code zip, import it into a run folder:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip ~/Downloads/generated-ui.zip \
  --option option-a
```

Mark an imported option as the selected design:

```bash
node scripts/design/import-generated-ui.mjs \
  --run-dir runs/<site-id> \
  --zip ~/Downloads/generated-ui.zip \
  --option option-b \
  --select
```

The script validates zip paths before extraction and writes only under `agent-2-5-output/`.

Run tests:

```bash
npm run test:ui-import
```

## Asset Quality Gate

After local UI assets are wired into a site, validate referenced images:

```bash
node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>
```

The gate rejects low-resolution ingredient hero images, undersized preset thumbnails, bad aspect ratios, SVG assets with embedded text, and SVG assets that wrap raster screenshots.

Run tests:

```bash
npm run test:asset-quality
```
