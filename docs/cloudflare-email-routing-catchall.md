# Cloudflare Email Routing Catch-All

## Purpose

Agent 6 uses this runbook to route all email for the launched domain to one destination inbox from root `.env.local`.

## Required Launch Gate

Run this step for every Agent 6 production launch. Root `.env.local` must contain a non-empty value:

```txt
CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO=<destination-email>
```

If the variable is missing or empty, stop Agent 6 and write a launch blocker in `agent-6-output/launch-report.md`. Do not skip Email Routing.

## Safety Rules

- Do not expose the full destination email in user-facing logs unless the user explicitly asks. Use a masked form such as `na***@example.com`.
- The user has authorized Agent 6 to remove legacy Google Workspace mail DNS records and Squarespace DNS records for the current launch domain.
- Do not delete unrelated MX, TXT, DKIM, SPF, DMARC, ownership verification, or unrelated subdomain records.
- If the domain uses a non-Google-Workspace mail provider, preserve it and report the conflict unless the user explicitly authorizes that migration.
- If Cloudflare requires destination inbox verification, stop after requesting/triggering verification and report that user inbox confirmation is required.
- Preserve unrelated DNS records.

## Required Migration Path

Use this path whenever Google Workspace or Squarespace legacy records are present for the current launch domain.

1. Delete legacy Google Workspace and Squarespace records for the current launch domain:

```txt
_domainconnect.<domain> CNAME _domainconnect.domains.squarespace.com
www.<domain> CNAME ext-sq.squarespace.com
<domain> MX smtp.google.com
<domain> TXT containing include:_spf.google.com
google._domainkey.<domain> TXT Google Workspace DKIM
<domain> A 198.49.23.145
<domain> A 198.49.23.144
<domain> A 198.185.159.144
<domain> A 198.185.159.145
```

2. Preserve the Pages binding record:

```txt
<domain> CNAME <pages-project>.pages.dev proxied=true
```

3. Add Cloudflare Email Routing DNS records from Cloudflare's current Email Routing DNS template for the zone:

```txt
<domain> MX route1.mx.cloudflare.net priority=2
<domain> MX route2.mx.cloudflare.net priority=55
<domain> MX route3.mx.cloudflare.net priority=70
<domain> TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"
<cloudflare-selector>._domainkey.<domain> TXT Cloudflare DKIM
```

4. Enable Email Routing for the zone.
5. Open Routing rules and enable the catch-all rule:

```txt
Custom address: Catch-All
Action: Send to an email
Destination: CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO
Status: Active
```

6. Verify that the destination address is verified, Email Routing is enabled/ready, the catch-all rule is active, and public DNS no longer returns the legacy Google Workspace/Squarespace records.

## Dashboard Procedure

Try token API first. Use `web-access` when API token permissions are insufficient or when Cloudflare requires interactive verification.

1. Start the `web-access` CDP proxy.
2. Open `https://dash.cloudflare.com/`.
3. Navigate to:

```txt
https://dash.cloudflare.com/<account-id>/<domain>/email/routing
```

4. Confirm the page is for the current run's domain.
5. Enable Email Routing if it is not already enabled.
6. Add destination address from `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO`.
7. If Cloudflare says the destination is unverified, trigger the verification email and report the pending user action.
8. Add or update a catch-all routing rule:

```txt
Custom address: Catch-all
Action: Send to email
Destination: CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO
Status: enabled
```

9. If Cloudflare offers automatic DNS setup for Email Routing, use it only if there are no existing non-Cloudflare mail provider records that should be preserved.
10. Verify final Email Routing status and write evidence to `launch-report.md`.

## Same-Origin API Notes

Prefer token API first. Prefer Dashboard same-origin API for fallback when address verification or DNS mutation requires the logged-in Dashboard session. Use manual Dashboard UI only if the same-origin API shape is unclear or blocked.

Use the zone ID discovered from the target domain via `docs/cloudflare-zone-discovery.md`; do not rely on a fixed root `.env.local` zone ID.

Do not guess undocumented mutation payloads for Email Routing. If the API shape is unclear, use Dashboard controls.

Observed Dashboard same-origin endpoints that can be used after confirming they still match the current page:

```txt
GET    /api/v4/accounts/<account-id>/email/routing/addresses
GET    /api/v4/zones/<zone-id>/email/routing
GET    /api/v4/zones/<zone-id>/email/routing/dns
POST   /api/v4/zones/<zone-id>/dns_records
DELETE /api/v4/zones/<zone-id>/dns_records/<record-id>
POST   /api/v4/zones/<zone-id>/email/routing/enable
PUT    /api/v4/zones/<zone-id>/email/routing/rules/catch_all
```

Use masked logging for destination email and DKIM values when running these calls.

## Reporting Requirements

`launch-report.md` must include:

- Whether `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO` was present.
- Masked destination email.
- Whether destination verification is complete or pending.
- Whether catch-all is enabled.
- Any DNS mail records changed.
- Any DNS mail records preserved.
- Confirmation that legacy Google Workspace and Squarespace records were removed or absent.
- Any blocker that prevented Email Routing completion.
