# Visual Restoration Example

## Purpose

Defines how Agent 3 proves 90% visual restoration.

## Agent 3 Scope

Agent 3 only restores visuals.

Allowed:

- Static HTML/CSS/JS shell
- Local visual assets from selected design
- Browser screenshots
- Visual diff report

Blocked:

- Tool functionality
- SEO content sections
- FAQ/schema/sitemap
- Production indexing
- Deployment work

## Required Screenshots

Compare:

```txt
agent-2-5-output/selected-design/target/desktop.png
agent-3-output/final-screenshots/desktop.png

agent-2-5-output/selected-design/target/mobile.png
agent-3-output/final-screenshots/mobile.png
```

## Mechanical Gate

```bash
node scripts/qa/check-visual-restoration-similarity.mjs --run-dir runs/<site-id> --write
```

Pass file:

```txt
gate-results/visual-restoration-similarity.json
```

## Blocks

- Agent 4 starting from a written score only
- Desktop similarity below 90%
- Mobile similarity below 90%
- Screenshot dimension mismatch
- Functionality work before visual lock

