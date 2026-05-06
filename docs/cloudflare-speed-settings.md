# Cloudflare Speed Settings

## Purpose

Agent 6 uses this runbook to apply Cloudflare's standard speed recommendations after the custom domain is live.

The current Dashboard flow has a Speed Settings page with a Recommendations tab and an `Enable all available settings` button.

## Trigger

Run after:

- Pages deployment succeeded.
- Custom domain is bound.
- DNS points to Pages.
- HTTPS returns 200.

## Required Launch Gate

This step is required for every Agent 6 production launch. It is complete only when the Dashboard action has been clicked successfully, or the page reports that all available settings are already enabled.

## Procedure

This is a Dashboard aggregate action. If a public token API cannot perform the aggregate `Enable all available settings` operation, use `web-access`.

1. Start the `web-access` CDP proxy.
2. Open `https://dash.cloudflare.com/`.
3. Navigate to:

```txt
https://dash.cloudflare.com/<account-id>/<domain>/speed/settings
```

4. Confirm the page title is `Speed Settings`.
5. Confirm the `Recommendations` tab is selected.
6. Click `Enable all available settings` if the button is present and enabled.
7. Wait for the page to update.
8. If the page already says all available settings are enabled, record that state.
9. Record visible statuses after the click or verification.

Common visible statuses:

```txt
Web analytics using real user measurement (RUM): Enabled
Speed Brain: Enabled or Disabled
HTTP/2: Enabled
HTTP/3: Enabled
HTTP/2 to Origin: Enabled
Polish: Upgrade required or Disabled on Free plan
```

## Safety Rules

- Do not upgrade the Cloudflare plan.
- Do not enable paid-only settings.
- Do not change settings that require origin-specific knowledge unless Cloudflare marks them as available in this recommendation flow.
- If the button is missing, disabled, or blocked by an upgrade prompt, record the visible reason and whether all available settings are already enabled.
- Do not treat paid-plan recommendations as launch blockers.

## Verification

After clicking `Enable all available settings`, verify:

- Page still loads over HTTPS.
- Production homepage returns HTTP 200.
- Calculator still renders.
- Visible Speed Settings recommendations are recorded.

## Reporting Requirements

`launch-report.md` must include:

- Whether the Speed Settings page opened.
- Whether `Enable all available settings` was available.
- Whether the click succeeded.
- Whether all available settings were already enabled.
- Which visible recommendations are enabled.
- Which visible recommendations were unavailable or required upgrade.
