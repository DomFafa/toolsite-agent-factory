# Tool Spec

## Calculator Model

The calculator sums selected nutrition items using local static data.

Each item contains:

- id
- name
- category
- portion
- calories
- protein
- carbs
- fat
- sodium
- fiber
- sugar
- saturatedFat
- defaultMultiplier

## Portion Multipliers

- Light: 0.5x
- Normal: 1x
- Extra: 1.5x
- Double: 2x

For items where a multiplier is awkward, such as drinks, chips, or tortillas, the UI may still allow the multiplier but should label the result as an estimate.

## Entree Logic

Meal format selection adds a default base:

- Bowl: no shell, 0 calories
- Burrito: flour tortilla, 320 calories
- Salad: supergreens/lettuce, 15 calories
- Tacos: 3 crispy corn tortillas by default, 210 calories
- Quesadilla: tortilla plus cheese base estimate, 430 calories

The user can still add or remove side tortilla, chips, guac, queso, and drinks.

## Required Interactions

- Select/deselect ingredients.
- Change each selected item's portion multiplier.
- Apply preset meals.
- Clear all selections.
- Copy meal summary.
- Display compare cards.
- Display source/accuracy note.

## Presets

Lean Chicken Bowl:

- Bowl
- Chicken
- Brown rice light
- Black beans light
- Fajita vegetables
- Fresh tomato salsa
- Lettuce

High Protein Double Chicken:

- Bowl
- Chicken double
- White rice normal
- Black beans normal
- Fajita vegetables
- Tomatillo red salsa

Lower Carb Steak Salad:

- Salad
- Steak
- Fajita vegetables
- Tomatillo green salsa
- Cheese
- Guacamole light

Veggie Bowl:

- Bowl
- Brown rice
- Black beans
- Fajita vegetables
- Roasted chili-corn salsa
- Fresh tomato salsa
- Guacamole

Burrito Reality Check:

- Burrito
- Chicken
- White rice
- Pinto beans
- Cheese
- Sour cream
- Fresh tomato salsa

## Validation Rules

- Totals should update instantly.
- Empty state should show zero totals and a helpful prompt.
- Copy summary should work without page reload.
- No data should leave the browser.
- Calculations should round to whole calories/milligrams and one decimal for macros only if needed.

## Handoff To Agent 3

Prototype the above as a complete interactive tool. The final UI should be dense enough for real use but still visually memorable.

## Handoff To Agent 4

Use TypeScript-friendly plain browser JavaScript in Astro. Keep data in the page or a local module. Avoid extra dependencies unless necessary.
