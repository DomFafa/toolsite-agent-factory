# Indexing Report

## Production Index State

The deployed Pages build was built with:

```bash
PUBLIC_INDEX_SITE=true
PUBLIC_SITE_URL=https://chipotlenutritioncalculator.app
```

Verified on the custom domain:

- Homepage: HTTP 200.
- Meta robots: `index,follow`.
- Robots.txt: `Allow: /`.
- Robots.txt sitemap reference: `https://chipotlenutritioncalculator.app/sitemap.xml`.
- Sitemap exists and uses the production custom domain.
- Cloudflare Web Analytics beacon remained installed after redeploy.

## Sitemap

Sitemap URL:

```txt
https://chipotlenutritioncalculator.app/sitemap.xml
```

Parsed URL count: 3.

Submitted URLs:

```txt
https://chipotlenutritioncalculator.app/
https://chipotlenutritioncalculator.app/privacy/
https://chipotlenutritioncalculator.app/terms/
```

## IndexNow

Completed.

- Key file: `runs/chipotle-nutrition-calculator/site/public/cf265ed40776f4c69280d3d417a110a0.txt`.
- Key: `cf26...10a0`.
- Key URL: `https://chipotlenutritioncalculator.app/cf26...10a0.txt`.
- Key URL verification: HTTP 200, file content matched the key.
- Endpoint: `https://api.indexnow.org/indexnow`.
- Submitted URL count: 3.
- HTTP status: 202.
- Result: accepted by IndexNow.

## Google Search Console

Completed through `web-access`.

- Required launch gate: completed.
- Login/access method: authenticated browser session through `web-access`.
- Property type: domain property.
- Property: `sc-domain:chipotlenutritioncalculator.app`.
- Verification method: Cloudflare Domain Connect / DNS provider.
- DNS record added: `google-site-verification=MASKED` TXT on `chipotlenutritioncalculator.app`.
- Cloudflare verification: Dashboard same-origin API confirmed the Google TXT record exists.
- Sitemap submitted: `https://chipotlenutritioncalculator.app/sitemap.xml`.
- Sitemap result: success.
- Discovered pages shown by GSC: 3.
- Homepage URL Inspection status before request: `URL is not on Google`; reason: discovered, not indexed yet.
- Request indexing result: requested successfully; GSC reported the URL was added to the priority crawl queue.
- Evidence screenshot: `google-indexing-requested.png`.

## Bing Webmaster Tools

Completed through `web-access`.

- Required launch gate: completed.
- Login/access method: authenticated browser session through `web-access`.
- Site import method: Bing Webmaster Tools `Import from Google Search Console`.
- OAuth scope shown by Bing/Google: Search Console view-only access.
- Import selection: only `https://chipotlenutritioncalculator.app/` was selected; unrelated GSC properties were deselected before import.
- Imported/opened Bing site: `chipotlenutritioncalculator.app/`.
- Sitemap submitted: `https://chipotlenutritioncalculator.app/sitemap.xml`.
- Sitemap result: success; Bing reported the sitemap was submitted for processing.
- Sitemap status after submission: `Submitted / Processing`.
- URL Submission submitted count: 3.
- URL Submission result: success; Bing reported `3 URLs submitted`.
- URL Submission URLs:

```txt
https://chipotlenutritioncalculator.app/
https://chipotlenutritioncalculator.app/privacy/
https://chipotlenutritioncalculator.app/terms/
```

- Evidence screenshots:
  - `bing-sitemap-submitted.png`
  - `bing-url-submission-success.png`

## Handoff

Automatic indexing now has a working baseline:

- Indexability verified.
- IndexNow key generated, deployed, and submitted.
- Google domain property verified through Cloudflare Domain Connect.
- Google sitemap submitted successfully.
- Google homepage request-indexing submitted successfully.

Workflow gap:

- None for the current test launch. Future Agent 6 runs should keep the same API-first/IndexNow baseline and use `web-access` for GSC/Bing console steps when an authenticated browser session exists.
