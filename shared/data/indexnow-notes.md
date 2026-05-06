# IndexNow Notes

IndexNow is required in Agent 6 after production launch.

Standard flow:

1. Generate or reuse `runs/<site-id>/site/public/<key>.txt`.
2. Rebuild and redeploy the site so `https://<domain>/<key>.txt` is live.
3. Parse `https://<domain>/sitemap.xml`.
4. Submit the sitemap URLs to `https://api.indexnow.org/indexnow`.
5. Record the masked key, URL count, endpoint, HTTP status, and accepted/rejected result.

Use:

```bash
node scripts/deploy/indexnow-submit.mjs prepare --domain <domain> --site-dir runs/<site-id>/site
node scripts/deploy/indexnow-submit.mjs submit --domain <domain> --site-dir runs/<site-id>/site --sitemap-url https://<domain>/sitemap.xml
```

Record:

- Key location
- Submitted URLs
- Submission timestamp
- API response or manual confirmation
