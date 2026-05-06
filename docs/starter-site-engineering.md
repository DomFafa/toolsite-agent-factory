# Starter Site Engineering

## Stack

- Astro
- Static output
- TypeScript allowed
- Plain CSS by default
- No backend
- No database
- No authentication
- No API keys

## Required pages

Each tool site should normally contain:

- Home/tool page
- About section on the same page or separate page
- FAQ section
- Privacy page if the tool processes user input locally
- Terms page if needed
- Sitemap
- Robots.txt

## Default behavior

- Tool logic runs fully in browser.
- User input is not sent to a server.
- Development uses `noindex`.
- Production switches to `index,follow` only after approval.

## Styling

- UI should be distinctive, not template-like.
- Code should be maintainable and simple.
- Avoid overengineering.
- Prefer reusable Astro components only when they reduce duplication.
