# Cloudflare Checklist

- [x] Cloudflare account access available through API token
- [x] Root `.env.local` contains no fixed `CLOUDFLARE_ZONE_ID`
- [x] Root `.env.local` contains no fixed `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`
- [x] Zone ID discovered from target domain by API
- [x] Zone found for `chipotlenutritioncalculator.app`
- [x] Zone status is active
- [x] Nameservers point to Cloudflare
- [x] Pages project created
- [x] Production build uploaded
- [x] Pages URL verified with HTTP 200
- [x] Custom domain added to Pages project
- [x] Custom domain verified
- [x] WWW custom domain added to Pages project
- [x] WWW DNS verification active
- [x] WWW Pages HTTP validation active
- [x] Required DNS CNAME record set
- [x] WWW DNS CNAME record set
- [x] WWW-to-apex 301 redirect configured
- [x] SSL active on custom domain
- [x] Speed Settings recommendations enabled where available
- [x] Images Transformations enabled for the zone
- [x] Email Routing catch-all configured
- [x] Cloudflare Web Analytics site token created or reused for `chipotlenutritioncalculator.app`
- [x] Cloudflare Web Analytics beacon injected into the production build
- [x] Site redeployed after Web Analytics injection
- [x] Live custom-domain HTML contains the Cloudflare Web Analytics beacon

## Speed Settings

- `Enable all available settings`: completed
- Enabled after action: Speed Brain, HTTP/2, HTTP/3, HTTP/2 to Origin, 0-RTT, Always Use HTTPS, TLS 1.3, Early Hints
- Not enabled because upgrade required: Polish, Enhanced HTTP/2 Prioritization

## Image Transformations

- Dashboard location: Images > Transformations
- Zone: `chipotlenutritioncalculator.app`
- API setting path: `/zones/<zone-id>/settings/transformations`
- Previous value: `off`
- Final value: `on`
- Method: token API
- Fallback required: no
- Verification: final API read returned `value: on`

## Cloudflare Web Analytics

- Required gate: completed
- Token behavior: per-domain Web Analytics site token, not account-wide
- Token API endpoint attempted: `GET /accounts/{account_id}/rum/site_info/list`
- Token API result: permission/authentication error (`403`, Cloudflare code `10000`)
- Fallback method: Dashboard same-origin API through `web-access`
- Site created or reused: reused existing site for `chipotlenutritioncalculator.app`
- Site token: `fab9...5e26`
- Build injection: `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<domain-site-token>`
- Redeploy evidence: Cloudflare Pages deployment `https://b826895a.dom-tool-chipotle-nutrition-calculator.pages.dev`
- Live beacon verification: `https://chipotlenutritioncalculator.app/` contains `beacon.min.js` and `data-cf-beacon`
- Post-redeploy WWW check: `https://www.chipotlenutritioncalculator.app/privacy?from=www` returns 301 to apex while preserving path and query

## Email Routing

- Destination source: root `.env.local` `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO`
- Destination: `vc***@gmail.com`
- Destination address status: verified
- Zone Email Routing status: enabled / ready
- Catch-all status: active
- Catch-all action: Send to an email
- Screenshot: `cloudflare-email-routing-catchall.png`

Deleted legacy DNS records before enabling routing:

```txt
_domainconnect CNAME _domainconnect.domains.squarespace.com
www CNAME ext-sq.squarespace.com
@ MX smtp.google.com priority=1
@ TXT "v=spf1 include:_spf.google.com ~all"
google._domainkey TXT Google Workspace DKIM
```

Added Cloudflare Email Routing DNS records:

```txt
@ MX route1.mx.cloudflare.net priority=2
@ MX route2.mx.cloudflare.net priority=55
@ MX route3.mx.cloudflare.net priority=70
@ TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"
cf2024-1._domainkey TXT Cloudflare DKIM
```

## WWW Redirect

- Pages custom domain: `www.chipotlenutritioncalculator.app`
- Pages custom domain status at last poll: `active`
- DNS verification: `active`
- HTTP validation: `active`
- DNS: `www CNAME dom-tool-chipotle-nutrition-calculator.pages.dev proxied=true`
- Redirect rule: `Redirect WWW to root`
- Expression: `(http.host eq "www.chipotlenutritioncalculator.app")`
- Action: 301 dynamic redirect to `https://chipotlenutritioncalculator.app` plus original path
- Query string: preserved
- Token/API path: token API succeeded for Pages custom domain; DNS and Rulesets required Dashboard same-origin API through `web-access`
- Validation note: redirect rule was briefly disabled while Pages completed HTTP validation, then re-enabled
- HTTP verification: `https://www.chipotlenutritioncalculator.app/privacy?from=www` returns 301 to `https://chipotlenutritioncalculator.app/privacy?from=www`
- Followed redirect verification: final status 200 at apex

## Current Public URLs

- Live custom domain: https://chipotlenutritioncalculator.app/
- Live Pages URL: https://dom-tool-chipotle-nutrition-calculator.pages.dev/

## Required DNS Record

```txt
Type: CNAME
Name: @
Target: dom-tool-chipotle-nutrition-calculator.pages.dev
Proxy: on
```

The existing apex A records were removed and this CNAME is now active.
