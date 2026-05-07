# Design Generation Prompt

You are designing a production-quality frontend UI for a static tool website.

## Site

- Product: Chipotle Nutrition Calculator
- Domain: ChipotleNutritionCalculator.app
- Language: English
- Market: United States
- Site type: static frontend tool
- Core job: Let users build a Chipotle-style meal and instantly estimate calories, protein, carbs, fat, sodium, fiber, sugar, and saturated fat.

## Non-Negotiable UX

- The first viewport must be the calculator itself, not a marketing landing page.
- Users must be able to select meal format, ingredients, portions, and presets immediately.
- Live nutrition totals must be visually prominent.
- Mobile must be designed, not merely stacked.
- The site must feel like a real premium food utility, not a generic SaaS dashboard or Tailwind calculator.

## Visual Direction

Use: original food photography style + light illustrated UI decoration.

This means:

- Ingredient cards can show original generated real-food photography-style thumbnails for rice, beans, chicken, steak, salsa, guacamole, tortilla, chips, and vegetables.
- UI decoration can use light, playful, hand-drawn food-brand illustration accents.
- The overall palette should be bright, warm, and food-forward.
- No dark theme.
- No official Chipotle assets.

## References

Use these references only for inspiration:

1. `https://chipotlenutrition.org/`
   - Borrow ingredient-card and food freshness cues.
   - Do not reuse images or layout.

2. `https://www.chipotle.com/nutrition-calculator`
   - Borrow food category logic and ingredient selection concept.
   - Do not use official images, logos, trade dress, or exact interactions.

3. `https://www.graza.co/?utm_source=chatgpt.com`
   - Borrow bright premium food-brand feel, playful illustration accents, warm palette, and lower-page layout rhythm.
   - Do not copy the hero, logo, copywriting, exact layout, or brand illustrations.

Reference screenshots are attached or available locally in:

- `runs/chipotle-nutrition-calculator/assets/references/chipotlenutrition-org-desktop.png`
- `runs/chipotle-nutrition-calculator/assets/references/chipotle-official-nutrition-desktop.png`
- `runs/chipotle-nutrition-calculator/assets/references/graza-desktop.png`
- `runs/chipotle-nutrition-calculator/assets/references/graza-lower-layout.png`

## Required Content / Tool Elements

Include these UI elements:

- H1: Chipotle Nutrition Calculator
- Meal format selector: bowl, burrito, salad, tacos, quesadilla
- Ingredient groups: rice, beans, protein, salsa, toppings, sides
- Portion controls: light, normal, extra, double
- Live nutrition totals: calories, protein, carbs, fat, sodium, fiber, sugar, saturated fat
- Quick presets: Lean Chicken Bowl, High Protein Double Chicken, Lower Carb Steak Salad, Veggie Bowl, Burrito Reality Check, Chips + Guac
- Compare cards: bowl vs burrito, normal vs extra rice, with/without chips
- Source/accuracy note
- Clear/reset action
- Copy/share meal summary action

Do not rewrite the SEO strategy. You may improve UI labels if needed, but preserve the product intent.

## Output Request

Generate three distinct UI directions:

- Option A
- Option B
- Option C

For each option, provide:

1. Desktop visual design target.
2. Mobile visual design target.
3. Runnable static frontend code in HTML/CSS/JS.
4. A short rationale explaining the visual concept.
5. Notes explaining how references were used safely without copying.

After the three options, recommend one selected option.

Package the selected option's frontend code as a downloadable zip if possible. If a zip is not possible, provide complete file contents for:

- `index.html`
- `styles.css`
- `script.js`

The code should visually match the selected design as closely as possible.
