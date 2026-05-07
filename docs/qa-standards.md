# QA Standards

## Design Gate checks

Agent 5 must run once after Agent 2.5 and before Agent 3. It must check:

- Agent 2.5 generated at least three design options or recorded a hard external blocker
- Selected design has runnable frontend code
- Selected design has desktop and mobile screenshots
- Local code screenshots closely match generated design targets
- First viewport is the usable tool, not a marketing hero
- UI fits Agent 2 tool behavior and information architecture
- User references were used appropriately, or open exploration was performed when none were provided
- Design does not copy protected reference assets, logos, exact layouts, trade dress, or copywriting
- UI does not look like a generic template
- Mobile layout is usable

Agent 3 cannot start until Design Gate passes.

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
