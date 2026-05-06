# Cloudflare Zone Discovery

## Purpose

Agent 6 must discover the Cloudflare zone ID from the current run's target domain. Do not store a fixed `CLOUDFLARE_ZONE_ID` in root `.env.local`.

Root `.env.local` is account-level only:

```txt
CLOUDFLARE_API_TOKEN=<account-or-user-token>
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO=<destination-email>
```

The zone ID is domain-specific. A workflow that launches many sites must resolve one zone ID per target domain at runtime.

## API-first Procedure

Given a target apex domain:

```txt
<domain>
```

query Cloudflare:

```txt
GET /zones?name=<domain>&account.id=<account-id>
```

Required validation:

- Exactly one zone matches the target domain.
- `result[0].name` equals the target apex domain.
- `result[0].status` is `active`.
- The zone belongs to `CLOUDFLARE_ACCOUNT_ID`.

If the target domain starts with `www.`, strip `www.` first and resolve the apex zone.

## Stale Environment Guard

If an old environment file still contains `CLOUDFLARE_ZONE_ID`, treat it only as an untrusted cache:

1. Fetch the zone by that ID.
2. Confirm its `name` exactly matches the current target apex domain.
3. Confirm its account matches `CLOUDFLARE_ACCOUNT_ID`.
4. If either check fails, ignore the env value and use domain discovery instead.

Do not write the discovered zone ID back into root `.env.local`.

## Dashboard Fallback

If the local token cannot list zones, use `web-access` with an authenticated `dash.cloudflare.com` tab.

From the Dashboard origin, use:

```js
await fetch('/api/v4/zones?name=<domain>&account.id=<account-id>', {
  credentials: 'include',
});
```

If the same-origin API is unavailable, open:

```txt
https://dash.cloudflare.com/<account-id>/<domain>
```

and confirm the Dashboard loads the intended zone. Prefer same-origin API data before manual UI confirmation.

## Reporting

Agent 6 outputs must record:

- Target apex domain.
- Zone discovery endpoint attempted.
- Whether token API or Dashboard fallback was used.
- Final zone name.
- Final zone status.
- Final zone ID, or a masked form if the report is user-facing.
