# Cloudflare Web Analytics

## Purpose

Agent 6 must create or reuse a Cloudflare Web Analytics site token for the launched domain, inject the beacon into the production build, redeploy, and verify the live HTML.

Do not ask the user to create `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` manually. This token is site-specific, not account-wide. Reuse a token only for the same domain/site.

## Required Inputs

Root `.env.local` must contain:

```txt
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=<account-id>
```

Agent 6 must discover the current domain's zone ID using `docs/cloudflare-zone-discovery.md`. `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` should not be stored in root `.env.local`; Agent 6 should read or create the token in Cloudflare for the current launch domain.

## API-first Flow

1. List existing Web Analytics sites:

```txt
GET /accounts/{account_id}/rum/site_info/list
```

2. Find a site whose `host`, `zone_name`, or rule host matches the launch domain.
3. If no site exists, create one:

```txt
POST /accounts/{account_id}/rum/site_info
```

Use a body like:

```json
{
  "host": "example.com",
  "zone_tag": "<zone-id>",
  "auto_install": false
}
```

4. Read `site_token` from the returned site object.

The Cloudflare API documents these endpoints under RUM Site Info:

```txt
https://developers.cloudflare.com/api/resources/rum/subresources/site_info/
```

Creating a Web Analytics site requires Cloudflare Account Settings Write permission. If the local token does not have that permission, continue with the Dashboard fallback below.

## Dashboard Fallback

If the token API returns an authentication or permission error, use `web-access` with an authenticated Cloudflare Dashboard tab.

From a `dash.cloudflare.com` page for the correct account, call the same endpoints through the Dashboard origin:

```js
await fetch('/api/v4/accounts/<account-id>/rum/site_info/list?per_page=100', {
  credentials: 'include',
});
```

If the site is missing:

```js
await fetch('/api/v4/accounts/<account-id>/rum/site_info', {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    host: '<domain>',
    zone_tag: '<zone-id>',
    auto_install: false,
  }),
});
```

Prefer this same-origin API fallback before manual Dashboard clicking.

## Build Injection

The starter site reads:

```txt
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN
```

Pass the token only into the production build environment for the current site:

```bash
PUBLIC_SITE_URL=https://example.com \
PUBLIC_INDEX_SITE=true \
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=<site-token> \
npm run build
```

Do not write a domain-specific Web Analytics token into the repository root `.env.local`, because future launches would accidentally reuse the wrong site's analytics stream.

## Verification

After deploying the rebuilt `dist/`, verify the live custom domain contains:

```txt
https://static.cloudflareinsights.com/beacon.min.js
data-cf-beacon
```

Also verify:

- The beacon token matches the current domain's Web Analytics site token.
- The production page still returns HTTP 200.
- `www.<domain>` still returns 301 to apex after redeploy.

## Reporting

Record in `launch-report.md`:

- Token API endpoint attempted and result.
- Whether Dashboard fallback was required.
- Whether a Web Analytics site was created or an existing site was reused.
- The token masked, for example `abcd...1234`.
- Build and deployment evidence after token injection.
- Live HTML beacon verification evidence.
