# SEO Plan

## Primary Target

- chipotle nutrition calculator

## Secondary Targets

- chipotle calorie calculator
- chipotle macro calculator
- chipotle nutrition facts calculator
- chipotle calories calculator
- chipotle meal calculator

## Long-Tail Targets

- chipotle bowl nutrition calculator
- chipotle burrito nutrition calculator
- chipotle burrito bowl calories
- chipotle chicken bowl calories
- chipotle double chicken calories
- chipotle tortilla calories
- chipotle quesadilla nutrition calculator
- chipotle chips and guac calories
- chipotle nutrition calculator accuracy
- chipotle light rice calories
- chipotle extra rice calories
- high protein chipotle bowl
- low calorie chipotle bowl
- keto chipotle bowl calculator

## Page Architecture

V1 uses one strong homepage with indexable sections rather than many thin pages.

Sections:

1. Calculator
2. Meal presets
3. Bowl vs burrito comparison
4. Ingredient calorie table
5. Portion accuracy guide
6. High-protein and low-calorie order ideas
7. FAQ

Optional V2 pages:

- `/bowl-calculator/`
- `/burrito-calculator/`
- `/quesadilla-calculator/`
- `/accuracy/`
- `/high-protein-bowls/`

## Metadata

Title:

Chipotle Nutrition Calculator: Calories, Macros, Sodium

Description:

Build a Chipotle bowl, burrito, salad, tacos, or side order and estimate calories, protein, carbs, fat, sodium, fiber, and sugar with light, extra, and double portions.

Canonical:

https://chipotlenutritioncalculator.app/

Open Graph:

- Title: Chipotle Nutrition Calculator
- Description: Estimate calories and macros for custom Chipotle orders.
- Type: website
- URL: https://chipotlenutritioncalculator.app/

## Structured Data

Use:

- `WebApplication`
- `FAQPage`

WebApplication fields:

- name: Chipotle Nutrition Calculator
- applicationCategory: HealthApplication
- operatingSystem: Any
- offers: free

FAQ topics:

- Is this official?
- How accurate are the results?
- Can I calculate extra or light portions?
- What adds the most calories?
- Does the calculator store my meal?

## Content Standards

- Use "estimate" and "published nutrition data" language.
- Include clear independent/not-affiliated note.
- Avoid medical advice.
- Do not claim exact restaurant portions.
- Avoid official brand assets.

## Handoff To Agent 3

The UI should keep the primary keyword in the H1 but make the calculator usable immediately. Do not create a marketing-first landing page.

## Handoff To Agent 4

Implement metadata, canonical URL, robots logic, sitemap support, structured data, and FAQ content directly in Astro.
