# Toolsite Agent Factory

A local IDE + Codex workflow for batch-generating lightweight, static, SEO-heavy, visually distinct tool websites and deploying each site to Cloudflare Pages.

This repository is intentionally file-first. Version 1 does **not** provide a full CLI, backend, dashboard, login system, database, API-key management, or automated production launch. Each agent is a folder of task documents that Codex can execute manually inside a local IDE.

## Core operating model

- One tool site = one independent Astro project = one Cloudflare Pages project = one independent domain.
- Default project name format: `dom-tool-<site-id>`.
- Domains are usually purchased in Squarespace, but nameservers are manually pointed to Cloudflare before Agent 6 runs.
- Agent 6 only handles domains whose Cloudflare zone is already active.
- Root `.env.local` should keep only account-level Cloudflare values: API token, account ID, and Email Routing destination. Agent 6 discovers each target domain's zone ID at runtime, creates/reuses the per-domain Web Analytics token during launch, and completes IndexNow, Google Search Console, and Bing Webmaster Tools submission as required launch gates.
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
4. Complete the Pre-Agent2 Toolsite SPEC Gate in `toolsite-spec.md`. Agent 2 is blocked until the five user inputs, six user decision areas, system baseline sections, and explicit user confirmation are complete and `gate-results/pre-agent2-toolsite-spec.json` passes.
5. Run Agent 2 to create the site brief from the confirmed Toolsite SPEC.
6. Run Agent 2.5 to generate codable and usable UI design directions, specs, usability contracts, local asset plans, and frontend code when available. This step is required even without UI references.
7. Run Agent 5 in Design Package Gate mode. Weak, non-codable, or visually attractive but unusable UI cannot proceed to visual restoration.
8. Run Agent 3 to create a static visual restoration and capture browser screenshots. Functionality and SEO stay deferred.
9. Run Agent 5 in Visual Restoration Gate mode. Agent 4 cannot proceed until desktop/mobile visual match reaches the default 90% threshold.
10. Run Agent 4 to add functionality and SEO from Agent 3 output without redesigning.
11. Run Agent 5 in Final QA mode across SEO, UI, desktop, mobile, build, noindex/index rules, and tool behavior.
12. Fill `approval.md` only after Final QA passes.
13. Run Agent 6 for Cloudflare Pages Direct Upload, domain binding, DNS, SSL, indexing, IndexNow, Email Routing catch-all, and Cloudflare Web Analytics.

## Quick start

```bash
cd toolsite-agent-factory
./scripts/create-run.sh keyword-density-checker keyworddensitychecker.com
```

Then open the generated folder:

```txt
runs/keyword-density-checker/
```

Before Agent 2, create `toolsite-spec.md` from `shared/templates/toolsite-spec.template.md`, complete the user-confirmed SPEC, and run:

```bash
npm run check:pre-agent2-spec -- --run-dir runs/keyword-density-checker --write
```

Use the relevant agent prompt files in order only after the required gates pass.

Human review points are recorded in `runs/<site-id>/human-review-events.jsonl`. Codex appends an open `human_review` event and pauses whenever the workflow requires user confirmation; Hermes may later forward the event `message` exactly as written, without explaining, summarizing, or rewriting it.

## Important safety rule

Production launch is blocked unless:

```txt
runs/<site-id>/approval.md
```

has the required production approval checkboxes completed.
