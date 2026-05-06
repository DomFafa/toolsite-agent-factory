# Site Brief

## Site Identity

- Site ID: chipotle-nutrition-calculator
- Domain: chipotlenutritioncalculator.app
- Primary keyword: Chipotle Nutrition Calculator
- Target market: United States
- Language: English
- Site type: static frontend-only nutrition calculator

## Product Positioning

Build a fast, independent one-page calculator for estimating calories and macros in a custom Chipotle order. The page should be useful immediately on mobile while a user is ordering: select meal format, ingredients, portion size, and side items, then see live totals.

This is an independent informational tool. The site should not use official Chipotle logos, official trade dress, or copy that implies affiliation.

## User Intent

Primary intent:

- Build a Chipotle meal and get instant calories, protein, carbs, fat, sodium, fiber, and sugar.

Secondary intent:

- Compare bowl vs burrito.
- Understand tortilla, rice, queso, guac, chips, and vinaigrette impact.
- Adjust light, normal, extra, or double portions.
- Find high-protein, low-calorie, and low-carb order ideas.
- Understand why real restaurant portions may differ from published nutrition data.

## Core Page Experience

The first viewport must be the calculator, not a marketing landing page.

Required UI:

- Sticky live total summary.
- Meal format selector: bowl, burrito, salad, tacos, quesadilla.
- Ingredient selector grouped by base, rice, beans, protein, salsa, toppings, sides, and drinks.
- Portion multiplier per selected ingredient: light, normal, extra, double.
- Quick presets: Lean Chicken Bowl, High Protein Double Chicken, Lower Carb Steak Salad, Veggie Bowl, Burrito Reality Check, Chips + Guac add-on.
- Compare panel: bowl vs burrito difference, normal vs extra rice, with/without chips.
- Clear/reset action.
- Copy/share meal summary.

Required result fields:

- Calories
- Protein
- Carbs
- Fat
- Sodium
- Fiber
- Sugar
- Saturated fat

## Visual Direction

Use a crisp nutrition-label-meets-order-ticket interface. The site should feel like a precise counter-service planning tool, not a generic SaaS dashboard.

Design traits:

- Light background with warm paper and fresh green accents.
- Dense but scannable controls.
- Nutrition-label typography for numbers.
- High-contrast ingredient chips.
- Strong mobile ergonomics.
- No oversized marketing hero.
- No official Chipotle branding or logo.

## Data Direction

Use published Chipotle nutrition data as the source basis and make the source note visible. Store data locally in the static site. No external API calls.

The first build can include the standard US menu core:

- Tortillas and meal bases
- White rice and brown rice
- Black beans and pinto beans
- Fajita vegetables
- Chicken, steak, barbacoa, carnitas, sofritas
- Fresh tomato salsa, roasted chili-corn salsa, tomatillo green salsa, tomatillo red salsa
- Sour cream, cheese, queso blanco, guacamole, lettuce, vinaigrette
- Chips and common sides/drinks

## SEO Requirements

Homepage title:

Chipotle Nutrition Calculator: Calories, Macros, Sodium

Meta description:

Build a Chipotle bowl, burrito, salad, tacos, or side order and estimate calories, protein, carbs, fat, sodium, fiber, and sugar with light, extra, and double portions.

Required structured data:

- WebApplication
- FAQPage

Required indexable content sections:

- How the calculator works
- Bowl vs burrito calories
- Best high-protein picks
- Lowest-calorie swaps
- Portion accuracy note
- FAQ

## Technical Constraints

- Astro static output.
- Client-side tool logic only.
- No backend.
- No database.
- No login.
- No API keys.
- No network calls from the calculator.
- Development defaults to noindex.
- Production index is enabled only after QA approval.

## Launch Requirements

- Build passes.
- QA report confirms calculator behavior and responsive layout.
- Production deployment targets Cloudflare Pages project `dom-tool-chipotle-nutrition-calculator`.
- Production URL: https://chipotlenutritioncalculator.app

## Assumptions

- User has pointed nameservers to Cloudflare.
- User asked to defer brand-safety review for this trial.
- Cloudflare credentials must be present locally before Agent 6 can deploy.

## Handoff To Agent 3

Create a code-first UI prototype for a dense, mobile-first nutrition calculator. Prioritize visible live totals, ingredient chips, portion controls, quick presets, comparison snippets, and a clean nutrition-label result panel.

## Handoff To Agent 4

Implement the production Astro site from the prototype direction. Use local data and browser JavaScript. Preserve noindex in development and support `PUBLIC_INDEX_SITE=true` for production.
