# Deploy Scripts

Agent 6 should verify `approval.md` and QA before using any deploy command.

## IndexNow

Prepare a public IndexNow key file before the final build:

```bash
node scripts/deploy/indexnow-submit.mjs prepare --domain <domain> --site-dir runs/<site-id>/site
```

After deploying the rebuilt site, submit the live sitemap URLs:

```bash
node scripts/deploy/indexnow-submit.mjs submit --domain <domain> --site-dir runs/<site-id>/site --sitemap-url https://<domain>/sitemap.xml
```

Run the unit tests:

```bash
npm run test:indexnow
```
