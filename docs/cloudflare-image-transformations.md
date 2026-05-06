# Cloudflare Image Transformations

## Purpose

Agent 6 uses this runbook to enable Cloudflare Images > Transformations for the launched zone.

## Required Result

For the current launch domain:

```txt
<domain>
```

the zone-level setting must be:

```txt
setting: transformations
value: on
```

In the Dashboard this appears under:

```txt
Images > Transformations > Zones
```

where the target zone should show `Enabled`.

## API-First Procedure

This step is required for every Agent 6 production launch. Try the Cloudflare token API first:

Use the zone ID discovered from the target domain via `docs/cloudflare-zone-discovery.md`; do not rely on a fixed root `.env.local` zone ID.

```txt
GET   /zones/<zone-id>/settings/transformations
PATCH /zones/<zone-id>/settings/transformations
Body: {"value":"on"}
```

The API may return a result with `id: image_resizing`; treat that as the Images Transformations setting when the request path is `/settings/transformations`.

If token API returns an authentication or permission error, use the Dashboard same-origin API through `web-access` with the same paths:

```txt
GET   /api/v4/zones/<zone-id>/settings/transformations
PATCH /api/v4/zones/<zone-id>/settings/transformations
```

## Dashboard Fallback

If both token API and same-origin API fail:

1. Load the `web-access` skill.
2. Open:

```txt
https://dash.cloudflare.com/<account-id>/images/transformations
```

3. Confirm the target account.
4. Find the row for the current launch domain.
5. Open the row action menu.
6. Choose `Enable`.
7. Verify the row changes to `Enabled`.

## Verification

After enabling, run:

```txt
GET /zones/<zone-id>/settings/transformations
```

Required result:

```txt
value: on
```

Record in `agent-6-output/launch-report.md`:

- Method used: token API, Dashboard same-origin API, or manual Dashboard UI.
- Previous value.
- Final value.
- Whether the setting was editable after the update.
- Any permission issue that caused fallback.
