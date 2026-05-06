# Agent 6 — Cloudflare Launch

## Purpose

Launch an approved, QA-passed static site to Cloudflare Pages and complete domain, analytics, and indexing setup.

## Operating rules

- Read all relevant files from the current run folder.
- Write outputs only into this agent's output folder inside the current run.
- Use English for system docs, reports, specs, and site content.
- Do not overengineer.
- Preserve V1 constraints: static frontend only, no backend, no login, no database, no API keys.
- Stop and write an issue note if required inputs are missing.
- Root `.env.local` should contain only account-level Cloudflare inputs: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO`. Do not require `CLOUDFLARE_ZONE_ID` or `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`.
- Required launch gate: discover the Cloudflare zone ID from the current run's target domain using `docs/cloudflare-zone-discovery.md`. Ignore stale fixed zone IDs unless they are verified to match the target domain.
- All Cloudflare operations are API-first. Use `docs/cloudflare-api-first-fallback.md`: try token API first, then Dashboard same-origin API through `web-access`, then manual Dashboard UI only if needed.
- If Cloudflare API or Wrangler can deploy Pages but cannot edit DNS because the token lacks Zone DNS permissions, use the Cloudflare Dashboard DNS fallback in `docs/cloudflare-dashboard-dns-fallback.md`.
- When using any Dashboard fallback, load the `web-access` skill and follow its browser/CDP rules. Prefer the Dashboard same-origin API over manual clicking after confirming the target account, zone, and records.
- Never delete unrelated DNS records. For the current launch domain, Agent 6 is authorized to remove legacy Google Workspace mail records and Squarespace records, then replace them with the required Cloudflare Pages and Email Routing records.
- Required launch gate: add `www.<domain>` as a Pages custom domain and configure a 301 redirect from `www` to apex. Use `docs/cloudflare-www-redirect.md`.
- Required launch gate: configure Cloudflare Email Routing catch-all to forward to `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO` from root `.env.local`. Use `docs/cloudflare-email-routing-catchall.md`. Missing destination email is a launch blocker, not a skip.
- Required launch gate: open Cloudflare Speed Settings and complete `Enable all available settings`, or verify all available settings are already enabled. Use `docs/cloudflare-speed-settings.md`. Paid-only upgrade requirements are recorded, not enabled.
- Required launch gate: enable Cloudflare Images > Transformations for the launched zone. Use `docs/cloudflare-image-transformations.md`.
- Required launch gate: create or reuse the Cloudflare Web Analytics site token for the launched domain, inject it into the production build, redeploy, and verify the live beacon. Use `docs/cloudflare-web-analytics.md`. Do not ask the user to create `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` manually.
- Do not write final status `launched` unless every required Cloudflare launch gate above is completed and verified.

## Task

Execute this agent for the current run according to `input.schema.md`, `output.schema.md`, and `checklist.md`.

## Handoff

At the end, include a concise handoff section for the next agent.
