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

## Usability Contract

- This is a real interactive calculator/tool, not a static portfolio image.
- The design must handle realistic dynamic data, long labels, selected/empty/error states, and responsive layout changes.
- Numeric stress values to fit without overflow:
  - `1,090mg`
  - `1,240mg`
  - `2,400mg`
  - `1,250 cal`
  - `120g`
  - `20.5g`
- Preset thumbnails and food/ingredient thumbnails must be clean images with no embedded text, mini labels, nutrition numbers, or screenshot fragments.
- Build/tool controls must remain readable and clickable. If dense columns make labels or images too small, use a wider card, 3x2 grid, tabs, accordion, or horizontal scrolling fallback.
- Food imagery must keep the primary subject visible; do not crop the ingredient so tightly that users cannot recognize it.
- Primary controls must have clear state semantics. Meal format choices, quick presets, ingredient toggles, portion buttons, and clearing actions must update selected state, calculated totals, or both.
- Do not include no-op or zero-effect `No` options unless they are implemented as mutually exclusive clearing actions without portion/size controls.
- Mutually exclusive choices must not be able to coexist in the designed state model.
- Optional active portion/size buttons should be reversible by clicking the active choice again, or the design must provide an obvious alternative undo path.
- After an option is selected, you must provide a downloadable high-resolution asset pack for every image slot. Do not crop these assets from the UI mockup screenshot.

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
- Usability contract
- Interaction state model
- Dynamic data fit notes
- UX self-audit
- Asset plan
- Asset quality contract
- Post-selection high-resolution asset pack plan
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
