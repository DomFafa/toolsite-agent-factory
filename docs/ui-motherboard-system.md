# UI Motherboard System

This document defines the Codex-ready starter system for `toolsite-agent-factory`.

The goal is not to freeze every future site into a fixed visual template. The goal is to give Agent 2.5 a stable design strategy, give Agent 3 a stable Astro starting point, and give Agent 4 a production-safe implementation shell.

## Core decision

Use two high-quality, general-purpose UI motherboards:

| Motherboard | Use when | Feel | First viewport pattern |
| --- | --- | --- | --- |
| A. Mature Tool Workbench | serious tools, calculators, checkers, converters, file tools, privacy/security tools, tests | mature, credible, clean | short intro + large workbench + left input/right result |
| B. Friendly Step Studio | randomizers, generators, creators, pickers, light personal utilities | friendly, human, light | short intro + step cards + strong copyable result |

These motherboards are **design strategies**, not fixed page skins.

Agent 2.5 must use the selected motherboard to request three distinct UI directions from GPT or another approved design surface. The three directions must differ in layout, result presentation, and mobile ordering. They must not be the same layout with different colors.

## House style rules

The house style is extracted from the user's existing tool sites. Do not send the existing site URLs as copy targets. Use the rules below instead.

- Tool first. The first viewport must show the usable tool, not a marketing hero.
- Clean light UI.
- Soft rounded cards.
- Clear input path.
- Strong result or feedback area.
- Subtle visual assets: scene illustration, small icon, doodle, or mini diagram.
- Human and friendly, but not childish.
- Polished enough to feel like a real product, not a form page.
- Mobile design has equal priority with desktop.

Avoid:

- Generic SaaS hero before the tool.
- Same layout with only color changes.
- Decorative blob/orb templates.
- Heavy dark cyber style.
- Dashboard/admin UI feeling.
- Pure text SEO page feeling.
- Over-cute cartoon style.
- Tiny unreadable labels.
- Fake controls with no visible effect.
- Mobile layouts that require zoom.

## Required route system

The default starter must support:

- `/` home/tool page
- `/about/`
- `/faq/`
- `/privacy/`
- `/terms/`
- `/sitemap.xml`
- `/robots.txt`

Header should stay light and tool-first:

- Logo/site name
- Tool link only

Footer should expose trust pages:

- About
- FAQ
- Privacy
- Terms

## Agent flow

1. Agent 2 writes product/SEO/tool/content/page-plan files.
2. Agent 2 makes an initial recommendation for root, behavior, result pattern, SEO content module type, and motherboard.
3. Agent 2.5 reads `shared/design-motherboards/` and may override the motherboard because it owns UI design strategy.
4. Agent 2.5 runs `scripts/design/build-agent25-motherboard-prompt.mjs --run-dir runs/<site-id> --write`.
5. Agent 2.5 sends the generated prompt through `web-access` to the approved external design surface.
6. Agent 2.5 obtains three options, stops for user selection, then obtains selected independent assets.
7. Agent 3 copies `starter-site/` to `runs/<site-id>/site/` and restores the selected design visually.
8. Agent 4 adds functionality and SEO only after visual restoration passes.
9. Agent 5 validates gates.
