# Agent 2.5 Prompt Builder

Use this file when building `agent-2-5-output/design-generation-prompt.md`.

The generated prompt must include:

1. Project identity.
2. Agent 2 source summaries.
3. Keyword root and real tool behavior.
4. Selected motherboard and reasoning.
5. House style rules.
6. Motherboard-specific design strategy.
7. Actual tool workflow and states.
8. Dynamic data stress values and long labels.
9. Result pattern.
10. Content module plan.
11. Fixed page requirements.
12. Mobile requirements.
13. Asset requirements.
14. Output contract.
15. Forbidden patterns.

## Mandatory opening

You are generating UI design directions for a static browser-based tool site. The output will be restored by Codex in Astro using HTML, CSS, and vanilla JavaScript. The selected design target must be restorable at 90% screenshot similarity on both desktop and mobile.

## Non-negotiables

- First viewport must be the real usable tool.
- No marketing hero before the tool.
- Mobile target is required and has equal priority with desktop.
- Realistic dynamic data must fit.
- Controls must have visible state semantics.
- Do not generate same layout with different colors.
- Do not include dashboard/login/pricing/API/leaderboard pages.
- Required pages: `/`, `/about/`, `/faq/`, `/privacy/`, `/terms/`, `/sitemap.xml`, `/robots.txt`.
- Header shows only site identity and Tool.
- Footer links About, FAQ, Privacy, Terms.
- About and FAQ need designed page directions.
- Privacy and Terms need inherited document-page style rules.
- Keep SEO copy/content finalization downstream; reserve layout and content module structure only.
