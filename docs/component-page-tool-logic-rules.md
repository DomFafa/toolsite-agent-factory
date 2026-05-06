# Component, Page, and Tool Logic Rules

## Page structure

A typical page should include:

1. Hero with clear keyword-aligned value proposition
2. Interactive tool panel above the fold or near it
3. Short trust/privacy note
4. How-to section
5. Use cases
6. FAQ
7. Footer

## Tool logic

- Must work without network calls.
- Must handle empty, invalid, and extreme inputs.
- Must display useful errors.
- Must not freeze the page on normal input sizes.
- Must preserve privacy for local-only tools.

## Components

Suggested components:

- `BaseLayout.astro`
- `ToolShell.astro`
- `Hero.astro`
- `Faq.astro`
- `SeoHead.astro`
- `MonetizationSlot.astro`

Do not create a large design system in V1.
