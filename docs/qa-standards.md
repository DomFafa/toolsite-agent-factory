# QA Standards

## Design Package Gate checks

Agent 5 must run once after Agent 2.5 and before Agent 3. It must check:

- Agent 2.5 generated at least three design options or recorded a hard external blocker
- Selected design has desktop and mobile target screenshots
- Selected design has design tokens, component spec, asset plan, restoration rules, and forbidden deviations
- Selected design has complete runnable frontend code, or the code-export blocker/fallback path is clearly recorded
- Selected design is practical for 90% restoration in Astro + HTML/CSS + vanilla JS
- Required local visual assets are present and safe to use
- First viewport is the usable tool, not a marketing hero
- UI fits Agent 2 tool behavior and information architecture
- User references were used appropriately, or open exploration was performed when none were provided
- Design does not copy protected reference assets, logos, exact layouts, trade dress, or copywriting
- UI does not look like a generic template
- Mobile layout is usable

Agent 3 cannot start until Design Package Gate passes.

## Visual Restoration Gate checks

Agent 5 must run after Agent 3 and before Agent 4. It must check:

- Agent 3 desktop screenshot exists
- Agent 3 mobile screenshot exists
- Agent 3 visual diff report exists
- Agent 3 output is still a static visual restoration, not a functionality-first implementation
- Desktop screenshot matches Agent 2.5 selected design target at 90% or higher
- Mobile screenshot matches Agent 2.5 selected design target at 90% or higher
- Major modules match the selected design target: first viewport, typography, spacing, cards, controls, visual assets, background, and mobile structure
- Functionality and SEO remain deferred until after the gate

Agent 4 cannot start until Visual Restoration Gate passes.

## Final QA checks

Agent 5 must run again after Agent 4. It must check:

- `npm install` succeeds
- `npm run build` succeeds
- No console errors for normal interaction
- Desktop screenshot exists
- Mobile screenshot exists
- Actual implementation matches Agent 2.5 selected design
- Actual implementation matches Agent 3 screenshots
- Tool works with normal and edge-case inputs
- Title and meta description are keyword aligned
- Canonical URL is correct
- Robots and sitemap are correct
- Development is noindex
- Production index switch is gated by approval
- FAQ schema is valid when FAQ exists
- Page is usable on mobile
- Basic accessibility passes keyboard and contrast sanity checks

## Visual QA rule

Agent 5 Final QA must compare:

```txt
agent-2-5-output/selected-design/
agent-3-output/final-screenshots/
```

against the actual Astro implementation rendered in browser.

The implementation must not drift from Agent 3 UI.
