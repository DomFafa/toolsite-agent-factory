# Implementation Handoff

## Accepted Prototype

The code prototype in `prototype-code/` defines the accepted UI direction.

## Required Carryover

- Preserve the first-screen calculator layout.
- Use the nutrition totals panel as the primary visual anchor.
- Keep ingredient groups compact.
- Keep portion controls embedded in selected ingredient chips.
- Add production SEO, structured data, legal notes, privacy/terms pages, sitemap, and robots handling in Agent 4.

## Known Gaps For Agent 4

- Prototype has representative data only; production should include a broader core data set.
- Prototype lacks structured data and SEO metadata.
- Prototype copy action has no visible success state.
- Prototype is plain HTML, not Astro.

## Handoff To Agent 4

Build the production Astro site in `runs/chipotle-nutrition-calculator/site/` using this prototype direction. Do not redesign the interface.
