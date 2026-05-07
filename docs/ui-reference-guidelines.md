# UI Reference Guidelines

## Input format

A UI reference object may contain:

- URL
- Desktop screenshot
- Mobile screenshot
- Short explanation of what to borrow
- Component or illustration image
- Reference type: mood, component, layout, illustration, or interaction

References are optional. Their absence never skips Agent 2.5. When no references are provided, Agent 2 must write an open-exploration dossier and Agent 2.5 must still generate UI directions through the external design model.

## Allowed reference strength

Use reference strength labels:

- `mood`: color, atmosphere, illustration feeling, softness/sharpness.
- `component`: button, card, form, navigation, panel, or control styling.
- `layout`: page rhythm, density, major region arrangement, or mobile ergonomics.

Agent 2 organizes these references. Agent 2.5 may extract:

- General color direction
- Card density
- Softness or sharpness of UI
- Illustration mood
- Section rhythm
- Overall whitespace feel
- Component interaction feel

Agents must not copy:

- Exact page composition
- Brand-specific assets
- Unique illustrations
- Exact copywriting
- Logos
- Distinctive interaction patterns

## Design generation rule

Agent 2.5 must generate design targets, design tokens, component specs, asset plans, restoration rules, forbidden deviations, and corresponding frontend code when possible through the external design model. The source of truth for implementation is the selected design package, then Agent 3's rendered screenshots after they pass the 90% Visual Restoration Gate.

Agent 3 then restores the static visual UI without redesigning it. Functionality and SEO come after the visual gate.
