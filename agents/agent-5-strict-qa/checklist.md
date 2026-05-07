# Checklist

# Design Package Gate

- [ ] Agent 2.5 generated at least three options or recorded a hard blocker
- [ ] Selected design has desktop and mobile target images
- [ ] Selected design has design tokens, component spec, asset plan, restoration rules, and forbidden deviations
- [ ] Selected design has complete runnable code, or a code-export blocker/fallback path is recorded
- [ ] Selected design is practical for 90% Astro/HTML/CSS/vanilla JS restoration
- [ ] Local visual assets are original/generated and safe to use when required
- [ ] First viewport is the usable tool
- [ ] Design fits Agent 2 tool behavior and information architecture
- [ ] User references were used appropriately, or open exploration was performed when none were provided
- [ ] Design does not copy protected reference assets, logos, exact layouts, or trade dress
- [ ] UI does not look like a generic template
- [ ] Mobile layout is usable
- [ ] Functionality and SEO are deferred until after visual restoration
- [ ] Design Package Gate pass/fail recorded before Agent 3

# Visual Restoration Gate

- [ ] Agent 3 final desktop screenshot exists
- [ ] Agent 3 final mobile screenshot exists
- [ ] Agent 3 visual diff report exists
- [ ] Agent 3 output is a static visual restoration, not a functionality-first implementation
- [ ] Desktop screenshot matches Agent 2.5 selected target at 90% or higher
- [ ] Mobile screenshot matches Agent 2.5 selected target at 90% or higher
- [ ] Visual deviations are documented by module
- [ ] Functionality and SEO are still deferred when this gate runs
- [ ] Visual Restoration Gate pass/fail recorded before Agent 4

# Final QA

- [ ] Build passes
- [ ] Desktop UI matches
- [ ] Mobile UI matches
- [ ] Final UI matches Agent 2.5 selected design without visual regression
- [ ] Tool behavior passes
- [ ] SEO passes
- [ ] Noindex rules pass
- [ ] Production gate is enforced
