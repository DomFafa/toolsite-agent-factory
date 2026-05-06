# Launch Report

## Result

Status: launched.

The production site is deployed and verified on the requested custom domain:

https://chipotlenutritioncalculator.app/

Cloudflare Pages fallback URL:

https://dom-tool-chipotle-nutrition-calculator.pages.dev/

## Deployment Details

- Pages project: `dom-tool-chipotle-nutrition-calculator`
- Production deployment URL: `https://b826895a.dom-tool-chipotle-nutrition-calculator.pages.dev`
- Stable Pages URL: `https://dom-tool-chipotle-nutrition-calculator.pages.dev/`
- Target custom domain: `chipotlenutritioncalculator.app`
- Custom domain status: active
- Custom domain verification: active
- WWW custom domain: `www.chipotlenutritioncalculator.app`
- WWW custom domain status: active
- WWW custom domain DNS verification: active
- WWW custom domain HTTP validation: active
- Cloudflare zone status: active
- Cloudflare nameservers:
  - `nola.ns.cloudflare.com`
  - `yadiel.ns.cloudflare.com`

## Zone Discovery

Configured for the new Agent 6 rule.

- Root `.env.local` no longer contains `CLOUDFLARE_ZONE_ID`.
- Root `.env.local` no longer contains `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`.
- Discovery method: token API.
- Endpoint: `GET /zones?name=chipotlenutritioncalculator.app&account.id=<account-id>`.
- Result: exactly one matching zone.
- Zone name: `chipotlenutritioncalculator.app`.
- Zone status: `active`.
- Zone ID: `4933...8ba8`.
- Fallback required: no.

## Commands Executed

```bash
PUBLIC_SITE_URL=https://chipotlenutritioncalculator.app PUBLIC_INDEX_SITE=true npm run build
npx --yes wrangler pages project create dom-tool-chipotle-nutrition-calculator --production-branch=main
npx --yes wrangler pages deploy dist --project-name=dom-tool-chipotle-nutrition-calculator --branch=main --commit-dirty=true
PUBLIC_SITE_URL=https://chipotlenutritioncalculator.app PUBLIC_INDEX_SITE=true PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<domain-site-token> npm run build
npx --yes wrangler pages deploy dist --project-name=dom-tool-chipotle-nutrition-calculator --branch=main --commit-dirty=true
POST /accounts/{account_id}/pages/projects/dom-tool-chipotle-nutrition-calculator/domains
Dashboard same-origin API:
- Deleted four apex `A` records pointing at Squarespace IPs.
- Added proxied apex `CNAME` to `dom-tool-chipotle-nutrition-calculator.pages.dev`.
- Added proxied `www` `CNAME` to `dom-tool-chipotle-nutrition-calculator.pages.dev`.
- Added Cloudflare Redirect Rule: `www` to apex, 301, preserve path and query string.
- Deleted legacy Squarespace/Google Workspace DNS records.
- Added Cloudflare Email Routing MX/SPF/DKIM records.
- Enabled Cloudflare Email Routing and catch-all forwarding.
Cloudflare token API:
- Enabled Images Transformations for `chipotlenutritioncalculator.app`.
- RUM/Web Analytics token API returned an authentication/permission error, so Dashboard same-origin API through `web-access` was used to reuse the existing Web Analytics site token.
```

## Production Verification

- Custom domain returns HTTP 200.
- Production page title is present.
- Production meta robots is `index,follow`.
- Production robots.txt is `Allow: /`.
- Production sitemap exists.
- Browser-rendered preset behavior works on custom domain:
  - High Protein Double Chicken: `750` calories, `77g` protein, `1830mg` sodium.
- Deployed Pages screenshot: `deployed-pages-dev.png`.
- Deployed custom-domain screenshot: `deployed-custom-domain.png`.
- Speed Settings screenshot: `cloudflare-speed-settings-enabled.png`.
- Email Routing catch-all screenshot: `cloudflare-email-routing-catchall.png`.
- WWW redirect rule screenshot: `cloudflare-www-redirect-rules.png`.

## DNS Changes

Deleted apex A records:

```txt
chipotlenutritioncalculator.app A 198.49.23.145
chipotlenutritioncalculator.app A 198.49.23.144
chipotlenutritioncalculator.app A 198.185.159.144
chipotlenutritioncalculator.app A 198.185.159.145
```

Added apex CNAME:

```txt
chipotlenutritioncalculator.app CNAME dom-tool-chipotle-nutrition-calculator.pages.dev proxied=true
```

Added `www` CNAME:

```txt
www.chipotlenutritioncalculator.app CNAME dom-tool-chipotle-nutrition-calculator.pages.dev proxied=true
```

## WWW Redirect

Configured.

- Pages custom domain: `www.chipotlenutritioncalculator.app`.
- Pages custom domain status at last poll: `active`.
- DNS verification status: `active`.
- HTTP validation status at last poll: `active`.
- DNS record: `www.chipotlenutritioncalculator.app CNAME dom-tool-chipotle-nutrition-calculator.pages.dev proxied=true`.
- Redirect rule: `Redirect WWW to root`.
- Rule expression: `(http.host eq "www.chipotlenutritioncalculator.app")`.
- Rule action: dynamic redirect.
- Status code: `301`.
- Target expression: `concat("https://chipotlenutritioncalculator.app", http.request.uri.path)`.
- Query handling: preserve query string.
- API path:
  - Pages custom domain was added with token API.
  - DNS and Rulesets token API returned permission errors, so Cloudflare Dashboard same-origin API through `web-access` was used.
- Validation note: the redirect rule was briefly disabled while Pages completed HTTP validation, then re-enabled after `www` became active.
- HTTP evidence:
  - `https://www.chipotlenutritioncalculator.app/privacy?from=www` returns `301`.
  - Location: `https://chipotlenutritioncalculator.app/privacy?from=www`.
  - Following redirects reaches `200` at `https://chipotlenutritioncalculator.app/privacy/?from=www`.

Deleted legacy Squarespace/Google Workspace records:

```txt
_domainconnect.chipotlenutritioncalculator.app CNAME _domainconnect.domains.squarespace.com
www.chipotlenutritioncalculator.app CNAME ext-sq.squarespace.com
chipotlenutritioncalculator.app MX smtp.google.com priority=1
chipotlenutritioncalculator.app TXT "v=spf1 include:_spf.google.com ~all"
google._domainkey.chipotlenutritioncalculator.app TXT Google Workspace DKIM
```

Added Cloudflare Email Routing records:

```txt
chipotlenutritioncalculator.app MX route1.mx.cloudflare.net priority=2
chipotlenutritioncalculator.app MX route2.mx.cloudflare.net priority=55
chipotlenutritioncalculator.app MX route3.mx.cloudflare.net priority=70
chipotlenutritioncalculator.app TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"
cf2024-1._domainkey.chipotlenutritioncalculator.app TXT Cloudflare DKIM
```

## Cloudflare Web Analytics

Configured.

- Required gate: completed.
- Token behavior: per-domain Web Analytics site token, not an account-wide reusable token.
- API endpoint attempted: `GET /accounts/{account_id}/rum/site_info/list`.
- Token API result: authentication/permission error (`403`, Cloudflare code `10000`), so fallback was required.
- Fallback method: Cloudflare Dashboard same-origin API through `web-access`.
- Site created or reused: reused existing Web Analytics site for `chipotlenutritioncalculator.app`.
- Web Analytics host: `chipotlenutritioncalculator.app`.
- Site token: `fab9...5e26`.
- Build injection: `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<domain-site-token>` was passed into the production build environment.
- Redeploy evidence: build passed with 0 errors / 0 warnings, then Cloudflare Pages deployment completed at `https://b826895a.dom-tool-chipotle-nutrition-calculator.pages.dev`.
- Live custom-domain verification:
  - `https://chipotlenutritioncalculator.app/` returns HTTP 200.
  - Live HTML contains `https://static.cloudflareinsights.com/beacon.min.js`.
  - Live HTML contains `data-cf-beacon`.
  - Live HTML token matches the masked Web Analytics site token.
- Post-redeploy redirect verification:
  - `https://www.chipotlenutritioncalculator.app/privacy?from=www` returns `301`.
  - Location: `https://chipotlenutritioncalculator.app/privacy?from=www`.

## Cloudflare Speed Settings

Agent 6 opened the Cloudflare Dashboard Speed Settings page:

```txt
https://dash.cloudflare.com/<account-id>/chipotlenutritioncalculator.app/speed/optimization/recommendations
```

The `Enable all available settings` action was available and was clicked successfully.

Final visible state:

- Site Recommendations: `All available settings are enabled`
- Web analytics using real user measurement (RUM): Enabled
- Speed Brain: Enabled
- HTTP/2: Enabled
- HTTP/3: Enabled
- HTTP/2 to Origin: Enabled
- 0-RTT Connection Resumption: Enabled
- Always use HTTPS: Enabled
- TLS 1.3: Enabled
- Early Hints: Enabled

Skipped because unavailable on the current plan:

- Polish: Disabled, upgrade required
- Enhanced HTTP/2 Prioritization: Disabled, upgrade required

Post-change verification:

- Custom domain still returns HTTP 200.
- Browser-rendered preset still works: `750` calories, `77g` protein, `1830mg` sodium.
- Production robots.txt remains indexable.

## Image Transformations

Configured.

- Dashboard location: Images > Transformations.
- Zone: `chipotlenutritioncalculator.app`.
- API setting path: `/zones/<zone-id>/settings/transformations`.
- Previous value: `off`.
- Final value: `on`.
- Method: Cloudflare token API.
- Fallback required: no.
- Verification: final API read returned `value: on`.

## Email Routing

Configured.

- Destination source: root `.env.local` `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO`.
- Destination: `vc***@gmail.com`.
- Destination address status: verified.
- Zone Email Routing status: enabled / ready.
- Catch-all rule: active.
- Catch-all action: Send to an email.
- DNS verification:
  - MX resolves to Cloudflare route1/route2/route3.
  - SPF resolves to Cloudflare Email Routing SPF.
  - Cloudflare DKIM TXT resolves.
  - Legacy Google Workspace MX/SPF/DKIM records removed.
  - Legacy Squarespace `_domainconnect` and `www` CNAME records removed.

## Automatic Indexing

Configured.

- Production indexability: verified on `https://chipotlenutritioncalculator.app/`.
- Sitemap: `https://chipotlenutritioncalculator.app/sitemap.xml`.
- Sitemap URL count: 3.
- IndexNow key file: `runs/chipotle-nutrition-calculator/site/public/cf265ed40776f4c69280d3d417a110a0.txt`.
- IndexNow key: `cf26...10a0`.
- IndexNow key URL: `https://chipotlenutritioncalculator.app/cf26...10a0.txt`.
- IndexNow submission endpoint: `https://api.indexnow.org/indexnow`.
- IndexNow HTTP status: `202`.
- IndexNow result: accepted.
- Google Search Console required launch gate: completed.
- Google Search Console access: authenticated browser session through `web-access`.
- Google Search Console property: `sc-domain:chipotlenutritioncalculator.app`.
- Google verification method: Cloudflare Domain Connect / DNS provider.
- Google sitemap submission: success.
- Google discovered pages from sitemap: 3.
- Google homepage request indexing: success; homepage added to the priority crawl queue.
- Evidence screenshot: `google-indexing-requested.png`.
- Bing Webmaster Tools required launch gate: completed.
- Bing Webmaster Tools access: authenticated browser session through `web-access`.
- Bing Webmaster Tools import: success through `Import from Google Search Console`.
- Bing import selection: only `https://chipotlenutritioncalculator.app/` selected; unrelated GSC properties deselected.
- Bing sitemap submission: success; status `Submitted / Processing`.
- Bing URL Submission: success; 3 URLs submitted.
- Bing evidence screenshots: `bing-sitemap-submitted.png`, `bing-url-submission-success.png`.
- Bing-compatible automatic submission: completed through IndexNow with HTTP 202.

## Handoff

The site is live on the custom domain. `www` is bound, active, and redirects to the apex domain with a 301 while preserving path and query string. Speed Settings recommendations are enabled where available. Images Transformations are enabled. Email Routing catch-all is active and forwarding to the configured destination. Cloudflare Web Analytics is installed in the live production HTML with the domain-specific token. Automatic indexing baseline is complete through IndexNow, Google Search Console, and Bing Webmaster Tools.
