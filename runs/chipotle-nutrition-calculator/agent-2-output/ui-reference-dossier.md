# UI Reference Dossier

## Reference Status

- Provided: yes
- Design generation mode: reference-guided
- Target domain: ChipotleNutritionCalculator.app
- Normalized domain for implementation: chipotlenutritioncalculator.app

## User References

### Reference 1: ChipotleNutrition.org

- Type: component | illustration
- URL: `https://chipotlenutrition.org/`
- Desktop screenshot: `runs/chipotle-nutrition-calculator/assets/references/chipotlenutrition-org-desktop.png`
- Reference strength: component
- Borrow:
  - Real food freshness cues
  - Ingredient selection card concept
  - Food-item thumbnails inside calculator controls
- Avoid:
  - Direct image reuse
  - Exact page layout
  - Copywriting
  - Brand claims

### Reference 2: Official Chipotle Nutrition Calculator

- Type: component
- URL: `https://www.chipotle.com/nutrition-calculator`
- Desktop screenshot: `runs/chipotle-nutrition-calculator/assets/references/chipotle-official-nutrition-desktop.png`
- Reference strength: component
- Borrow:
  - Food category logic
  - Ingredient selection concept
  - Real ingredient photography cues
- Avoid:
  - Official logo
  - Official food images
  - Official trade dress
  - Exact interaction cloning
  - Exact layout

### Reference 3: Graza

- Type: mood | layout | illustration
- URL: `https://www.graza.co/?utm_source=chatgpt.com`
- Desktop screenshot: `runs/chipotle-nutrition-calculator/assets/references/graza-desktop.png`
- Lower-page screenshot: `runs/chipotle-nutrition-calculator/assets/references/graza-lower-layout.png`
- Reference strength: mood
- Borrow:
  - Bright premium food-brand feel
  - Warm, non-dark palette
  - Playful illustration accents
  - Food photography plus light illustration balance
  - Lower-page layout rhythm and generous breathing room
- Avoid:
  - 1:1 copying
  - Exact hero composition
  - Brand assets
  - Copywriting
  - Logo
  - Dark UI

## Design Direction

Use original food photography style plus light illustrated UI decoration:

- Ingredient cards may use original generated real-food photography cues for rice, beans, chicken, steak, salsa, guacamole, tortilla, chips, and vegetables.
- Decorative elements may use light, playful food-brand illustration accents inspired by Graza's warmth and spacing.
- The UI must stay bright and practical, not dark.
- The first viewport must be the calculator itself, not a marketing hero.
- The design should feel like a premium food utility, not a generic nutrition dashboard.

## Must Avoid

- Do not reuse official Chipotle images or logo.
- Do not copy official Chipotle trade dress.
- Do not copy Graza's exact layout, copy, brand marks, or unique illustrations.
- Do not create a dark theme.
- Do not bury the calculator below a marketing section.

## Handoff To Agent 2.5

- Use reference-guided generation.
- Send only product/design context and reference screenshots; do not send secrets or deployment credentials.
- Ask the external design model for at least three distinct directions.
- Require each direction to include desktop design, mobile design, and runnable static frontend code.
