# QA Standards

## Required checks

Agent 5 must check:

- `npm install` succeeds
- `npm run build` succeeds
- No console errors for normal interaction
- Desktop screenshot exists
- Mobile screenshot exists
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

Agent 5 must compare:

```txt
agent-3-output/final-screenshots/
```

against the actual Astro implementation rendered in browser.

The implementation must not drift from Agent 3 UI.
