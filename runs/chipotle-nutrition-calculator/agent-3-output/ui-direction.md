# UI Direction

## Concept

The final interface should feel like a precise nutrition ticket for a custom fast-casual order. The calculator is the product, so it starts in the first viewport with live totals, meal format controls, ingredient groups, and preset orders.

## Visual System

- Tone: clean, practical, food-counter utility.
- Layout: dense desktop grid with a sticky totals rail; single-column mobile layout with the totals panel first.
- Color: warm paper base, dark ink, fresh green actions, tomato red warnings, muted corn/yellow accents.
- Typography: characterful sans-serif for interface labels, mono numerals for nutrition totals.
- Components: segmented meal selector, ingredient chips, compact portion controls, nutrition-label total panel, comparison strips.

## UX Priorities

1. The user can build a meal without reading instructions.
2. Totals update immediately after each choice.
3. Portion multipliers are always visible for selected ingredients.
4. Presets demonstrate common search intents.
5. Source and accuracy notes are visible but not dominant.

## Handoff To Agent 4

Implement this direction in Astro as a static site with local browser JavaScript. Do not add backend calls or external data fetching.
