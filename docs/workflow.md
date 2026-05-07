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

Agent 2.5 uses `web-access` to generate UI design directions and corresponding frontend code through the ChatGPT web UI or another approved design generation surface.

This step is mandatory even when no UI references are provided.

## Phase 2.6: Design Gate

Agent 5 runs in Design Gate mode. It reviews the selected design before implementation. Agent 3 cannot start until this gate passes.

## Phase 3: Approved UI prototype

Agent 3 cleans the Agent 5-approved design code, runs it locally, and captures desktop/mobile screenshots from the actual rendered page. It must not freely redesign.

## Phase 4: Astro implementation

Agent 4 implements the site in Astro using Agent 3 output. It must not redesign the approved UI.

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
