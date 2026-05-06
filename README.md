# Toolsite Agent Factory

A local IDE + Codex workflow for batch-generating lightweight, static, SEO-heavy, visually distinct tool websites and deploying each site to Cloudflare Pages.

This repository is intentionally file-first. Version 1 does **not** provide a full CLI, backend, dashboard, login system, database, API-key management, or automated production launch. Each agent is a folder of task documents that Codex can execute manually inside a local IDE.

## Core operating model

- One tool site = one independent Astro project = one Cloudflare Pages project = one independent domain.
- Default project name format: `dom-tool-<site-id>`.
- Domains are usually purchased in Squarespace, but nameservers are manually pointed to Cloudflare before Agent 6 runs.
- Agent 6 only handles domains whose Cloudflare zone is already active.
- Root `.env.local` should keep only account-level Cloudflare values: API token, account ID, and Email Routing destination. Agent 6 discovers each target domain's zone ID at runtime and creates/reuses the per-domain Web Analytics token during launch.
- All system docs, specs, reports, and site content are written in English by default.
- Development builds stay `noindex` until QA passes and production launch is explicitly approved in `approval.md`.
- Cloudflare Web Analytics is the default analytics system. Agent 6 creates or reuses a per-domain Web Analytics token during launch and injects it into the production build. GA4 is not included by default.
- Monetization slots are reserved, but ads are not enabled by default.
- V1 has no related-tools internal linking between separate sites.

## Repository map

```txt
toolsite-agent-factory/
  agents/          Agent task folders used by Codex
  docs/            Product, workflow, QA, launch, and operating docs
  examples/        Example brief and example run folder
  runs/            Real generated site runs live here locally
  scripts/         QA, deploy, and helper script placeholders
  shared/          Shared schemas, templates, and reusable prompt rules
  starter-site/    Minimal Astro starter used by Agent 4
```

## Recommended local workflow

1. Use Agent 1 to research a keyword. Stop after the report. Do not auto-trigger building.
2. Create a new run folder under `runs/<site-id>/`.
3. Fill the run input using `shared/templates/run-input.template.md`.
4. Run Agent 2 to create the site brief.
5. Run Agent 3 to generate the UI in code and capture browser screenshots as the real design source.
6. Run Agent 4 to implement the Astro site from Agent 3 output. Do not redesign.
7. Run Agent 5 for strict QA across SEO, UI, desktop, mobile, build, noindex/index rules, and tool behavior.
8. Fill `approval.md` only after QA passes.
9. Run Agent 6 for Cloudflare Pages Direct Upload, domain binding, DNS, SSL, indexing, IndexNow, Email Routing catch-all, and Cloudflare Web Analytics.

## Quick start

```bash
cd toolsite-agent-factory
./scripts/create-run.sh keyword-density-checker keyworddensitychecker.com
```

Then open the generated folder:

```txt
runs/keyword-density-checker/
```

Use the relevant agent prompt files in order.

## Important safety rule

Production launch is blocked unless:

```txt
runs/<site-id>/approval.md
```

has the required production approval checkboxes completed.
