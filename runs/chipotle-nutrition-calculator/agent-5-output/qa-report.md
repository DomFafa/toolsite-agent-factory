# QA Report

## Result

Status: passed with fixes applied.

## Verification Commands

```bash
npm run build
bash scripts/qa/run-local-qa.sh runs/chipotle-nutrition-calculator/site
curl -sS http://127.0.0.1:4327/robots.txt
curl -sS http://127.0.0.1:4327/sitemap.xml
curl -sS http://127.0.0.1:4327/
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --dump-dom "http://127.0.0.1:4327/"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --dump-dom "http://127.0.0.1:4327/?preset=1"
npx --yes playwright screenshot --channel chrome --viewport-size 1440,1100 --full-page "http://127.0.0.1:4327/?preset=1" runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/desktop.png
npx --yes playwright screenshot --channel chrome --viewport-size 390,844 --full-page "http://127.0.0.1:4327/?preset=0" runs/chipotle-nutrition-calculator/agent-5-output/qa-screenshots/mobile.png
```

## Evidence

- Astro check: 0 errors, 0 warnings, 0 hints.
- Astro build: passed.
- Local QA script: passed.
- Development robots: `Disallow: /`.
- Development meta robots: `noindex,nofollow`.
- Canonical URL: `https://chipotlenutritioncalculator.app/`.
- Sitemap URLs use `chipotlenutritioncalculator.app`.
- Default homepage behavior after fix: `0` calories.
- High Protein Double Chicken preset: `750` calories, `77g` protein, `1830mg` sodium.
- Burrito Reality Check preset: `1085` calories, `118g` carbs.

## Screenshots

- Desktop: `qa-screenshots/desktop.png`
- Mobile: `qa-screenshots/mobile.png`

## Fixes Applied During QA

1. Fixed invalid nested-button layout in Agent 3 prototype.
2. Fixed production script preset parsing bug where a missing `preset` query parameter became `0` and auto-applied the first preset.
3. Fixed canonical fallback from `example.com` to `chipotlenutritioncalculator.app`.
4. Silenced Astro script-processing hints by adding explicit `is:inline`.

## Checklist

- [x] Build passes
- [x] Desktop UI matches accepted direction
- [x] Mobile UI matches accepted direction
- [x] Tool behavior passes
- [x] SEO passes
- [x] Development noindex rules pass
- [x] Production gate is enforced

## Remaining Risks

- Nutrition data should be periodically checked against Chipotle's latest official menu data.
- `npm audit` reports 5 moderate dependency advisories in the installed dependency graph. No forced upgrade was applied because it could change framework versions during this test run.
- Cloudflare deployment cannot be completed until Cloudflare credentials are present in `.env.local`.

## Handoff To Agent 6

Agent 6 may proceed after production approval is completed and Cloudflare credentials are set. Production build must set `PUBLIC_INDEX_SITE=true` and `PUBLIC_SITE_URL=https://chipotlenutritioncalculator.app`.
