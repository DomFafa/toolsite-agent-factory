# Cloudflare Launch Runbook

## Preconditions

- Cloudflare account access is available locally.
- Domain nameservers already point to Cloudflare.
- Cloudflare zone is active.
- Agent 5 QA passed.
- `approval.md` is completed.
- Root `.env.local` contains account-level values only:

```txt
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO=<destination-email>
```

Do not require `CLOUDFLARE_ZONE_ID` or `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` in root `.env.local`.

## Pages project naming

```txt
dom-tool-<site-id>
```

## Launch steps

1. Build Astro site.
2. Confirm production metadata uses `index,follow`.
3. Discover the zone ID for the target domain using `docs/cloudflare-zone-discovery.md`.
4. Upload `dist/` through Cloudflare Pages Direct Upload.
5. Bind apex custom domain.
6. Confirm apex DNS records; use API-first fallback from `docs/cloudflare-api-first-fallback.md`.
7. Bind `www` custom domain and configure 301 redirect from `www` to apex using `docs/cloudflare-www-redirect.md`.
8. Confirm SSL is active for apex and `www`.
9. Apply Cloudflare Speed Settings recommendations using `docs/cloudflare-speed-settings.md`.
10. Enable Images > Transformations for the zone using `docs/cloudflare-image-transformations.md`.
11. Configure Email Routing catch-all using `docs/cloudflare-email-routing-catchall.md`.
12. Create or reuse the per-domain Cloudflare Web Analytics token, inject it into the production build, redeploy, and verify the live beacon using `docs/cloudflare-web-analytics.md`.
13. Submit sitemap to Google Search Console and Bing Webmaster Tools.
14. Submit changed URLs with IndexNow when applicable.
15. Write launch report.

Steps 3, 6, 7, 9, 10, 11, and 12 are required Cloudflare launch gates. Do not mark the run `launched` until each gate is completed and verified.

## Cloudflare operation policy

Every Cloudflare operation is API-first:

```txt
docs/cloudflare-api-first-fallback.md
```

If token API cannot complete an operation due to permission, authentication, unsupported endpoint, or Dashboard-only flow, Agent 6 must finish the operation through `web-access`. Prefer Dashboard same-origin API calls before manual UI clicks.

## Zone discovery

Agent 6 must discover the zone ID from the target domain for every launch:

```txt
docs/cloudflare-zone-discovery.md
```

Do not keep or require a fixed `CLOUDFLARE_ZONE_ID` in root `.env.local`. If a stale value exists from an older setup, validate that it belongs to the current target domain before using it; otherwise ignore it and use domain discovery.

## DNS fallback

If Wrangler or Cloudflare API can create the Pages project and bind the custom domain but cannot edit DNS records because the token lacks Zone DNS permissions, Agent 6 must use:

```txt
docs/cloudflare-dashboard-dns-fallback.md
```

This fallback uses an authenticated Cloudflare Dashboard browser session through `web-access`. It is part of the standard Agent 6 launch path and should be attempted before declaring custom-domain launch blocked.

## Email Routing

Agent 6 must configure Email Routing catch-all. Root `.env.local` must contain:

```txt
CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO=<destination-email>
```

Use:

```txt
docs/cloudflare-email-routing-catchall.md
```

If the destination address is missing, stop and write a launch blocker. If the destination address requires verification, trigger/request verification and record the pending inbox action; do not mark Email Routing complete until the destination is verified and catch-all is active.

## WWW redirect

Agent 6 must add `www.<domain>` as a Pages custom domain and create a 301 redirect from `www` to the apex domain:

```txt
docs/cloudflare-www-redirect.md
```

Try the Cloudflare token API first. If the token lacks DNS or Rulesets permissions, use `web-access` and the Dashboard same-origin API before manual UI clicks.

## Speed settings

Agent 6 must open the Cloudflare Dashboard Speed Settings page and complete `Enable all available settings`, or verify that all available settings are already enabled:

```txt
docs/cloudflare-speed-settings.md
```

## Image Transformations

Agent 6 must enable Images > Transformations for the launched zone:

```txt
docs/cloudflare-image-transformations.md
```

Try the Cloudflare token API first. If the token lacks permission, use `web-access` and the Dashboard same-origin API before manual UI clicks.

## Cloudflare Web Analytics

Agent 6 must create or reuse the Web Analytics site token for the launched domain and inject it into the production build:

```txt
docs/cloudflare-web-analytics.md
```

Try the Cloudflare token API first. If the token lacks Account Settings Write or RUM/Web Analytics permissions, use `web-access` and the Dashboard same-origin API before manual UI clicks. Do not ask the user to create the token manually, and do not reuse a token from another domain.

## Stop conditions

Stop before deployment if approval is incomplete or QA failed.
