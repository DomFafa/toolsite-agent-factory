# Toolsite Design-Review Subset

## Purpose

Defines the adapted Agent 5 design review for tool sites.

This is not the full gstack `/design-review`.

The full skill is a live-site audit and fix loop. This subset is a pre-implementation gate for generated tool-site designs.

## Required Checks

1. First Impression Gate
   - Blocks: first viewport does not show what the tool is, where to input, what to click, and where results appear.

2. AI Slop Gate
   - Blocks: generic hero copy, decorative blobs/orbs, emoji design, feature-grid filler, centered-everything template UI.

3. Tool-First Trunk Test
   - Blocks: unclear site identity, current tool, input path, action path, output path, or mobile path.

4. Visual Hierarchy / Scan Gate
   - Blocks: SEO, marketing, or decorative content appearing before the actual tool.

5. Mobile Tool Usability Gate
   - Blocks: mobile layout that is only stacked desktop UI, unreadable, untappable, or zoom-disabled.

6. Interaction Feel Gate
   - Blocks: controls with no visible state change, unclear feedback, missing reset/clear behavior, or hidden result changes.

## Mechanical Gate

```bash
node scripts/qa/check-toolsite-design-review.mjs --run-dir runs/<site-id> --write
```

Pass file:

```txt
gate-results/toolsite-design-review.json
```

## Rule

Agent 3 is blocked until this gate passes.

