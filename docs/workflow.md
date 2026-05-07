# Workflow

## Phase 0: Prepare run folder

Create a run folder using:

```bash
./scripts/create-run.sh <site-id> <domain>
```

Example:

```bash
./scripts/create-run.sh keyword-density-checker keyworddensitychecker.com
```

## Phase 1: Keyword research

Use Agent 1 only when keyword validation is needed. Agent 1 stops after producing a keyword research report. It does not launch Agent 2.

## Phase 2: Build brief

Agent 2 receives:

- Primary keyword
- Target domain
- Brief requirements
- Optional UI reference objects

It produces product, SEO, content, tool specs, and a UI reference dossier for Agent 2.5.

## Phase 2.5: UI design generation

Agent 2.5 uses `web-access` to generate UI design directions and implementation-ready design packages through the ChatGPT web UI or another approved design generation surface.

This step is mandatory even when no UI references are provided.

The default restoration target is 90%. Agent 2.5 must request codable UI output: target screenshots, design tokens, component specs, asset plans, restoration rules, forbidden deviations, and frontend code when available.

## Phase 2.6: Design Package Gate

Agent 5 runs in Design Package Gate mode. It reviews the selected design package before implementation. Agent 3 cannot start until this gate passes.

## Phase 3: Static visual restoration

Agent 3 creates a static visual restoration prototype from the approved design package, runs it locally, and captures desktop/mobile screenshots from the actual rendered page.

Agent 3 must not implement calculator functionality, SEO sections, FAQ, schema, sitemap, production indexing, or deployment. The only goal is to make the rendered screenshots match the selected design target at 90% or higher.

## Phase 3.5: Visual Restoration Gate

Agent 5 runs in Visual Restoration Gate mode. It compares Agent 3 rendered screenshots against the Agent 2.5 selected design target.

Agent 4 cannot start until desktop and mobile visual match scores are at least 90%, unless the user explicitly approves an exception.

## Phase 4: Astro implementation

Agent 4 implements the site in Astro using Agent 3 output. It must not redesign the approved UI.

Functionality is added after the visual gate. SEO metadata, SEO content sections, FAQ, schema, sitemap, and robots logic are added after the visual gate and must not disturb the visual lock.

## Phase 5: QA

Agent 5 runs again in Final QA mode and checks:

- Desktop UI screenshot vs actual implementation
- Mobile UI screenshot vs actual implementation
- Agent 2.5 selected design vs actual implementation
- SEO metadata
- Structured data
- Tool behavior
- Accessibility basics
- Build success
- Noindex/index rules
- Sitemap/robots rules
- Content quality

## Phase 6: Production launch

Agent 6 runs only after:

- Agent 5 Final QA passed
- `approval.md` is completed
- Cloudflare zone is active
- Domain nameservers already point to Cloudflare

Agent 6 produces a complete launch report.
