# Cloudflare API-First Fallback

## Purpose

Agent 6 uses this policy for every Cloudflare operation.

## Required Rule

For each Cloudflare change:

1. Try the local Cloudflare token API first when an API endpoint exists.
2. If token API returns authentication, permission, or unsupported-operation errors, use `web-access` with the authenticated Cloudflare Dashboard session.
3. In `web-access`, prefer Dashboard same-origin API calls from a `dash.cloudflare.com` page context.
4. Use manual Dashboard UI clicks only when the same-origin API is unavailable or blocked.
5. Do not mark Agent 6 launched until the required operation is completed or a hard blocker is written to `agent-6-output/launch-report.md`.

If token API returns an authentication, permission, or unsupported-operation error, the fallback attempt is mandatory evidence. Missing `web-access`, Dashboard same-origin API, or manual Dashboard UI fallback evidence causes `gate-results/agent6-completion.json` to fail.

## Common Fallback Signals

```txt
403
Authentication error
code 10000
permission denied
read-only token
unsupported endpoint
Dashboard-only flow
```

## Reporting Requirements

For every fallback, `launch-report.md` must include:

- Operation attempted.
- Token API endpoint and failure summary.
- Fallback method: Dashboard same-origin API or manual UI.
- Final verification evidence.
