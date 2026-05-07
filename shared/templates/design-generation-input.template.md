# Design Generation Input

## Product Source Of Truth

- Site brief:
- Tool spec:
- Content plan:
- SEO plan:

## Design Generation Mode

- reference-guided | open-exploration

## UI Goal

Describe the intended product feel and the first-viewport user workflow.

## Visual Restoration Policy

- Target visual match: 90%
- Implementation stack: Astro + HTML + CSS + vanilla JS
- Local generated PNG/SVG assets: allowed
- Priority order: visual restoration first, tool functionality second, SEO content/schema after visual restoration
- Avoid hard-to-code visual effects unless exported as local assets

## Required Screens

- Desktop
- Mobile

## Required Frontend Output

- Desktop/mobile design targets
- Design tokens with concrete values
- Component and layout specs
- Asset plan
- Restoration rules
- Forbidden deviations
- Runnable static HTML/CSS/JS when possible
- No backend
- No external API keys
- First viewport is the tool itself

## Reference Constraints

- Borrow:
- Avoid:

## Prompt For External Design Model

Write the prompt Agent 2.5 should send through `web-access`.

The prompt must state that the UI image is not only for presentation; it must be designed for later 90% restoration by Codex in Astro.
