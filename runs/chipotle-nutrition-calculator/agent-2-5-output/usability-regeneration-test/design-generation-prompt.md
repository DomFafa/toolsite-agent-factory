# Chipotle Nutrition Calculator UI Regeneration Prompt

You are designing a production-ready UI for a real interactive calculator, not a static poster.

## Product

Build an independent `Chipotle Nutrition Calculator` for `chipotlenutritioncalculator.app`.

The first viewport must be the usable tool:

- Live totals: calories, protein, carbs, fat, sodium, fiber, sugar, saturated fat.
- Meal formats: bowl, burrito, salad, tacos, quesadilla.
- Ingredient groups: rice, beans, protein, salsa, toppings, sides.
- Portion controls per item: light, normal, extra, double.
- Quick presets: Lean Chicken Bowl, High Protein Double Chicken, Lower Carb Steak Salad, Veggie Bowl, Burrito Reality Check, Chips + Guac.
- Compare cards: bowl vs burrito, normal vs extra rice, with vs without chips.
- Clear/reset and share/copy actions.

No backend, no login, no database, no API calls. The implementation target is Astro + HTML + CSS + vanilla JS.

## Visual Direction

Use a bright premium food utility feel:

- Warm paper background.
- Fresh green action color.
- Tomato/corn accents.
- Original food photography style plus light illustration decoration.
- Useful calculator first, no marketing hero.
- Do not use official Chipotle logos, official images, official trade dress, or exact reference layouts.
- You may reference the mood of premium food sites such as Graza, but do not copy them.

## Hard Usability Contract

This is the most important part. Do not sacrifice usability for a pretty screenshot.

The UI must support real dynamic calculator data:

- Numeric stress values must fit without overflow:
  - `1,090mg`
  - `1,240mg`
  - `2,400mg`
  - `1,250 cal`
  - `120g`
  - `20.5g`
- Build ingredient labels must be readable. Target minimum 12px desktop, 14px mobile for primary labels.
- Interactive portion buttons must be reliably clickable/tappable. Target at least 32px desktop and 44px mobile where possible.
- Food images must show the food clearly. Do not crop the primary subject off the card.
- Quick preset thumbnails must be clean food-only images. Do not put text, badges, nutrition numbers, labels, or screenshot fragments inside thumbnails. All text must be real HTML text next to the image.
- If six desktop ingredient columns make images or text too small, do not force six tiny cards. Use 3x2 cards, grouped tabs, horizontal group navigation, or another layout that keeps the tool usable.
- Mobile must be app-like and task-first, not just the desktop squeezed down.

## Required Output

Create three distinct design options: A, B, C.

For each option, provide:

1. Desktop mockup image.
2. Mobile mockup image.
3. Design tokens.
4. Component/layout specification.
5. Usability contract confirmation.
6. Dynamic data fit notes explaining where the stress values fit.
7. UX self-audit: explicitly say how you avoided numeric overflow, tiny labels, dirty thumbnails, cropped food, and unusable controls.
8. Asset plan: list food images/illustrations needed as clean assets.
9. Restoration rules for Codex to reproduce it with 90% screenshot fidelity.
10. Runnable HTML/CSS/JS if possible.

Optimize for this priority order:

1. Real user usability.
2. Feasible implementation.
3. 90% visual restoration.
4. Visual personality.

Do not produce a beautiful mockup that would fail as a real calculator.
