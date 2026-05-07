# Cloudflare Dashboard DNS Fallback

## Purpose

Agent 6 uses this fallback when Cloudflare Pages deployment works, but DNS mutation through Wrangler or the Cloudflare API fails because the local token lacks Zone DNS edit permissions.

This fallback uses the user's authenticated Cloudflare Dashboard session through `web-access`.

## Trigger Conditions

Use this fallback when all are true:

- Agent 5 Final QA passed.
- `approval.md` authorizes production launch.
- The Cloudflare zone is active.
- Pages project creation or deployment succeeded.
- The Pages custom domain is pending because DNS is not pointed at Pages.
- API or Wrangler DNS record mutation fails due to token permission errors.

Common signals:

```txt
Authentication error
code 10000
CNAME record not set
custom domain status: pending
verification_data.status: pending
```

## Safety Rules

- Only operate on the current run's domain.
- This runbook is for Pages apex/`www` DNS fallback only. Do not touch MX records here.
- This runbook is for Pages apex/`www` DNS fallback only. Do not touch TXT records here, including SPF, DKIM, DMARC, Google verification, or other ownership records.
- Do not touch unrelated subdomains.
- The current run owns apex and `www`; replace legacy Squarespace apex/`www` records when they conflict with Pages.
- Email Routing mail-record migration is handled only by `docs/cloudflare-email-routing-catchall.md`.
- Only delete or replace apex A, AAAA, or CNAME records that prevent the current apex domain from pointing to the Pages project.
- Record every deleted and created DNS record in `agent-6-output/launch-report.md`.

## Required Target

For the default project naming scheme:

```txt
Project: dom-tool-<site-id>
Pages target: dom-tool-<site-id>.pages.dev
Custom domain: <domain>
```

For apex domains, create:

```txt
Type: CNAME
Name: @
Target: dom-tool-<site-id>.pages.dev
Proxy: on
TTL: Auto
```

Cloudflare will flatten the apex CNAME.

## Browser Procedure

1. Load the `web-access` skill and start its CDP proxy.
2. Open a new background tab to `https://dash.cloudflare.com/`.
3. If Cloudflare shows a security check, wait for auto verification. If it cannot proceed, ask the user to complete the check in Chrome.
4. Navigate to the current zone's DNS records page:

```txt
https://dash.cloudflare.com/<account-id>/<domain>/dns/records
```

5. Confirm the page shows the current run's domain.
6. Dismiss cookie banners if needed.
7. Prefer the Dashboard same-origin API below. Use manual UI clicks only if the same-origin API is unavailable.

## Preferred Same-Origin API Method

Run from the authenticated `dash.cloudflare.com` page context with `web-access` eval. This uses the browser session cookies, not the local API token.

Use the zone ID discovered from `docs/cloudflare-zone-discovery.md`. Do not read a fixed `CLOUDFLARE_ZONE_ID` from root `.env.local`.

First list records:

```js
await fetch(`/api/v4/zones/${zoneId}/dns_records?name=${domain}`, {
  credentials: "include"
}).then((res) => res.json())
```

Then:

- Select records whose `name` is exactly the apex domain.
- Delete conflicting `A` and `AAAA` records.
- Delete conflicting apex `CNAME` records that do not point to the Pages target.
- Preserve `MX`, `TXT`, and unrelated records.
- Create the proxied apex CNAME to the Pages target.

Template:

```js
(async () => {
  const zone = "<zone-id>";
  const domain = "<domain>";
  const pagesTarget = "dom-tool-<site-id>.pages.dev";
  const headers = { "content-type": "application/json" };

  const listRes = await fetch(`/api/v4/zones/${zone}/dns_records?name=${domain}`, {
    credentials: "include"
  });
  const list = await listRes.json();

  const apexRecords = list.result.filter((record) => record.name === domain);
  const conflicting = apexRecords.filter((record) => (
    record.type === "A" ||
    record.type === "AAAA" ||
    (record.type === "CNAME" && record.content !== pagesTarget)
  ));

  const deleted = [];
  for (const record of conflicting) {
    const res = await fetch(`/api/v4/zones/${zone}/dns_records/${record.id}`, {
      method: "DELETE",
      credentials: "include"
    });
    deleted.push({
      type: record.type,
      name: record.name,
      content: record.content,
      ok: res.ok,
      status: res.status
    });
  }

  const createRes = await fetch(`/api/v4/zones/${zone}/dns_records`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      type: "CNAME",
      name: "@",
      content: pagesTarget,
      ttl: 1,
      proxied: true
    })
  });

  const created = await createRes.json();

  return JSON.stringify({
    deleted,
    created: {
      ok: createRes.ok,
      status: createRes.status,
      record: created.result && {
        type: created.result.type,
        name: created.result.name,
        content: created.result.content,
        proxied: created.result.proxied
      },
      errors: created.errors
    }
  });
})()
```

## Verification

After changing DNS:

1. Poll Pages custom domain status:

```txt
GET /accounts/<account-id>/pages/projects/<project-name>/domains/<domain>
```

Required final state:

```txt
status: active
verification_data.status: active
```

2. Verify HTTPS:

```bash
curl -I -L https://<domain>/
```

Expected:

```txt
HTTP/2 200
server: cloudflare
```

3. Verify production metadata:

```bash
curl -sS https://<domain>/ | rg 'index,follow|canonical'
curl -sS https://<domain>/robots.txt
curl -sS https://<domain>/sitemap.xml
```

4. Verify browser-rendered calculator behavior with a preset URL.

5. Save a screenshot into `agent-6-output/`.

## Reporting Requirements

If this fallback is used, `launch-report.md` must include:

- The API/CLI failure that triggered fallback.
- The Dashboard DNS fallback method used.
- Deleted DNS records.
- Created DNS records.
- Preserved records, especially MX/TXT.
- Final custom domain status.
- Final HTTP/HTTPS and calculator behavior evidence.
