# Cloudflare WWW Redirect

## Purpose

Agent 6 uses this runbook to add the `www` hostname and redirect it permanently to the apex domain.

## Required Result

For a launch domain like:

```txt
<domain>
```

Agent 6 must configure:

```txt
www.<domain> CNAME dom-tool-<site-id>.pages.dev proxied=true
www.<domain> -> 301 -> https://<domain>{path}?{query}
```

## API-First Procedure

This step is required for every Agent 6 production launch. Try the Cloudflare token API first. If a token lacks DNS or Rulesets permissions, fall back to the Dashboard same-origin API through `web-access`.

Use the zone ID discovered from the target domain via `docs/cloudflare-zone-discovery.md`; do not rely on a fixed root `.env.local` zone ID.

1. Add the Pages custom domain:

```txt
POST /accounts/<account-id>/pages/projects/<project-name>/domains
Body: {"name":"www.<domain>"}
```

2. Ensure `www` DNS exists:

```txt
www.<domain> CNAME <pages-project>.pages.dev proxied=true
```

3. Create or update the zone entrypoint ruleset for:

```txt
phase: http_request_dynamic_redirect
```

Rule:

```json
{
  "description": "Redirect WWW to root",
  "expression": "(http.host eq \"www.<domain>\")",
  "action": "redirect",
  "enabled": true,
  "action_parameters": {
    "from_value": {
      "status_code": 301,
      "target_url": {
        "expression": "concat(\"https://<domain>\", http.request.uri.path)"
      },
      "preserve_query_string": true
    }
  }
}
```

If no entrypoint exists, create a zone ruleset:

```txt
POST /zones/<zone-id>/rulesets
Body: {"name":"default","kind":"zone","phase":"http_request_dynamic_redirect","rules":[...]}
```

## Dashboard Fallback

When token API calls return permission errors for DNS or Rulesets, use `web-access` with an authenticated `dash.cloudflare.com` tab.

Use the Dashboard same-origin API first:

```txt
POST   /api/v4/accounts/<account-id>/pages/projects/<project-name>/domains
GET    /api/v4/zones/<zone-id>/dns_records?name=www.<domain>
POST   /api/v4/zones/<zone-id>/dns_records
GET    /api/v4/zones/<zone-id>/rulesets/phases/http_request_dynamic_redirect/entrypoint
PUT    /api/v4/zones/<zone-id>/rulesets/phases/http_request_dynamic_redirect/entrypoint
POST   /api/v4/zones/<zone-id>/rulesets
```

If the same-origin API is blocked, use the Dashboard UI:

1. Pages project > Custom domains > Set up a custom domain > add `www.<domain>`.
2. DNS > Records > add proxied CNAME `www` to the Pages target.
3. Rules > Overview > Rule templates > `Redirect from WWW to root` > Create from template.
4. Confirm the template uses `www.<domain>` as the source and `<domain>` as the destination.
5. Deploy the rule as a 301 redirect.

## Verification

Required checks:

```bash
curl -I "https://www.<domain>/privacy?from=www"
```

Expected:

```txt
HTTP/2 301
location: https://<domain>/privacy?from=www
```

Also verify following redirects reaches HTTP 200:

```bash
curl -sSL -o /dev/null -w '%{http_code} %{url_effective}\n' "https://www.<domain>/privacy?from=www"
```

Expected final URL is the apex domain.

Pages custom domain status may briefly show `pending` after creation. Record the status in `launch-report.md`; the redirect is considered functional once HTTPS requests to `www` return the expected 301.

If the Pages custom domain remains pending with:

```txt
verification_data.status: active
validation_data.method: http
validation_data.status: pending
```

the redirect rule may be intercepting Pages HTTP validation. In that case:

1. Temporarily disable only the `Redirect WWW to root` rule.
2. Verify `https://www.<domain>/` reaches the Pages site.
3. Poll the Pages custom domain until validation becomes `active`.
4. Re-enable the redirect rule.
5. Re-run the 301 verification.
