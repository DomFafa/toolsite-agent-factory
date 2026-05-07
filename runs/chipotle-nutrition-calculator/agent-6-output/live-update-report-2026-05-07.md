# Live Update Report

## Update

- Time: 2026-05-07 23:19:10 CST
- Domain: `https://chipotlenutritioncalculator.app/`
- Cloudflare Pages project: `dom-tool-chipotle-nutrition-calculator`
- Pages deployment URL: `https://ab431976.dom-tool-chipotle-nutrition-calculator.pages.dev`

## Build And Deploy

Production build used:

```bash
PUBLIC_SITE_URL=https://chipotlenutritioncalculator.app
PUBLIC_INDEX_SITE=true
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<domain-site-token>
npm run build
```

Deployment command:

```bash
npx --yes wrangler pages deploy dist --project-name=dom-tool-chipotle-nutrition-calculator --branch=main --commit-dirty=true
```

## Verification

- Apex domain returned `HTTP/2 200`.
- Live HTML includes `No rice`, `No beans`, and `No protein`.
- Live HTML includes `clearGroup: true` for mutually exclusive clearing actions.
- Live HTML includes reversible portion handling via `selected[id] === numericValue`.
- Live HTML includes Cloudflare Web Analytics beacon and `data-cf-beacon`.
- Live HTML robots meta is `index,follow`.
- `https://www.chipotlenutritioncalculator.app/` returned `HTTP/2 301` to `https://chipotlenutritioncalculator.app/`.
