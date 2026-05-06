# Starter Site

Minimal Astro starter for a static, frontend-only tool site.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Production index switch

Set `PUBLIC_INDEX_SITE=true` only after QA passes and production launch is approved.

Development default is noindex.

## Cloudflare Web Analytics

The layout supports `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` as a production build variable, but this should not live in a persistent site env file. Agent 6 creates or reuses the per-domain Cloudflare Web Analytics token during launch and passes it into the production build. Do not reuse one site's token for another domain.
