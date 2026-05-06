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
- Optional UI reference object

It produces a complete site brief for Agent 3 and Agent 4.

## Phase 3: Code-first UI

Agent 3 writes UI code first, runs it locally, and captures desktop/mobile screenshots from the actual rendered page. The browser screenshots are the final effect images.

If a UI reference is provided, Agent 3 uses it as medium reference only: color direction, card feeling, illustration tone, or layout rhythm. It must not clone or copy the reference site.

## Phase 4: Astro implementation

Agent 4 implements the site in Astro using Agent 3 output. It must not redesign the UI.

## Phase 5: QA

Agent 5 checks:

- Desktop UI screenshot vs actual implementation
- Mobile UI screenshot vs actual implementation
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

- Agent 5 passed
- `approval.md` is completed
- Cloudflare zone is active
- Domain nameservers already point to Cloudflare

Agent 6 produces a complete launch report.
