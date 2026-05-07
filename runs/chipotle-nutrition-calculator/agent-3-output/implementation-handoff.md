# Implementation Handoff

## Accepted Visual Restoration

The Astro implementation in `site/` now defines the accepted UI direction for the next step. The old `prototype-code/` remains historical context, but the current visual lock is captured by:

- `final-screenshots/ui-restore-desktop.png`
- `final-screenshots/ui-restore-mobile.png`
- `visual-lock.md`

## Required Carryover

- Preserve the first-screen calculator layout.
- Use the nutrition totals panel as the primary visual anchor.
- Keep ingredient groups compact.
- Keep portion controls embedded in selected ingredient chips.
- Preserve the local UI artwork in `site/public/ui-assets/`.
- Add or refine functionality inside the locked shell. Do not redesign the shell.

## Known Gaps For Agent 4

- Visual match is estimated at 89%, so Agent 5 should keep the 90% visual gate active.
- Mobile currently locks the Rice panel as the visible first group. Group switching can be added later without changing the shell.
- Compare cards are simplified versus the exact GPT mock.
- SEO expansion must wait until after the visual gate is accepted.

## Handoff To Agent 4

Continue from `runs/chipotle-nutrition-calculator/site/` and keep the current UI as the visual lock. Do not redesign the interface when adding functionality or SEO.
