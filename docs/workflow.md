# Workflow

Standard flow reference: before starting any new toolsite run, Codex must read `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`.

## Phase 0: Prepare run folder

Create a run folder using:

```bash
./scripts/create-run.sh <site-id> <domain>
```

Example:

```bash
./scripts/create-run.sh keyword-density-checker keyworddensitychecker.com
```

Before any agent work starts after run creation, Codex must output a run-start acknowledgement with:

- Flow files read
- Current run phase
- Next agent to execute
- Actions forbidden in the current phase

## Phase 1: Keyword research

Use Agent 1 only when keyword validation is needed. Agent 1 stops after producing a keyword research report. It does not launch Agent 2.

## Phase 1.5: Pre-Agent2 Toolsite SPEC Gate

Agent 2 is blocked until the Pre-Agent2 Toolsite SPEC Gate passes.

Codex must complete a lightweight user Q&A and write `runs/<site-id>/toolsite-spec.md` before Agent 2 starts. The target Q&A length is 12-20 rounds. Complex tools may use up to 30 rounds. If the six user decision areas are already clear before 12 rounds, Codex may output the SPEC early only when `toolsite-spec.md` explicitly records:

```txt
六个用户决策区已清楚，用户同意提前输出 SPEC。
```

The user must provide five required fields before the gate can pass:

- Keyword / 关键词
- Target domain / 目标域名
- UI reference / UI 参考
- UX reference / UX 参考
- Extra ideas, constraints, or mimic points / 额外想法 / 限制 / 模仿点

UI reference and UX reference are required fields, but they do not require URLs. The user may explicitly write `no clear reference`, `open exploration`, or `follow tool-site best practices`.

The Q&A must cover six user decision areas:

- Tool Purpose
- First Viewport UX
- Input / Output Model
- Result Experience
- UI / UX Direction
- Non-goals

Codex fills these baseline sections from system defaults. They do not need to be asked one by one:

- Technical Constraints
- Page Boundary
- Agent Workflow Boundary
- SEO Baseline
- Success Criteria Baseline

`toolsite-spec.md` must include:

```md
## User Confirmation
- [x] User confirmed this Toolsite SPEC before Agent2 starts.
- Confirmation text:
- Confirmed by:
- Confirmed at:
```

Run `node scripts/qa/check-pre-agent2-toolsite-spec.mjs --run-dir runs/<site-id> --write`; `gate-results/pre-agent2-toolsite-spec.json` must pass before Agent 2 can start.

If any condition is missing, Codex must stop and output exactly:

```txt
Pre-Agent2 Toolsite SPEC Gate is not complete. Agent2 is blocked.
```

## Phase 2: Build brief

Agent 2 receives:

- Confirmed Toolsite SPEC
- Passing `gate-results/pre-agent2-toolsite-spec.json`

It produces product, SEO, content, tool specs, and a UI reference dossier for Agent 2.5.

Agent 2 must also produce a Toolsite Page Plan table in `page-plan.md` or `content-plan.md`:

```txt
page | type | status | reason | implementation owner
```

Allowed page statuses are `required`, `optional-recommended`, `optional-not-needed`, and `rejected`. Every formal tool site must include `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt` as `required`. Agent 2 may recommend optional SEO/support pages, but must give a reason. `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, and `/blog` are rejected unless the current user explicitly requests them.

Run `node scripts/qa/check-page-plan.mjs --run-dir runs/<site-id> --write`; `gate-results/page-plan.json` must pass before Agent 2.5 can start.

## Phase 2.5: UI design generation

Before Agent 2.5 starts, run `node scripts/run/check-web-access.mjs --run-dir runs/<site-id> --write`. The pipeline is blocked unless the repo-local `web-access/` skill files and relative script paths pass this preflight.

Agent 2.5 uses `web-access` to generate UI design directions and implementation-ready design packages through the ChatGPT web UI or another approved design generation surface.

This step is mandatory even when no UI references are provided.

The default restoration target is 90%. Agent 2.5 must request codable and usable UI output: target screenshots, design tokens, component specs, usability contract, interaction-state model, dynamic data fit notes, UX self-audit, asset plans, asset-quality contract, restoration rules, forbidden deviations, and frontend code when available.

Agent 2.5's GPT prompt must explicitly require: Astro + HTML/CSS/vanilla JS restoration, 90% screenshot similarity, first viewport as the real tool, no dynamic-data overflow, usable mobile layout, complete interaction states, no pretty-but-unusable UI, and no UX sacrifice for visual impact.

Agent 2.5 must prove the options and selected design came from GPT or an approved external design surface. It must save `external-design-evidence/external-response.md`, `conversation-screenshot.png`, `source-provenance.md`, `selected-design-lineage.md`, and `external-design-proof.json`. The proof must map Option A/B/C, `chat-delivery/options-board.png`, the selected option, desktop/mobile targets, and selected package back to the GPT response or GPT option source images. Local HTML/CSS option boards, manual mocks, reconstructed screenshots, locally generated targets, Codex-local packages, and formal-project 3-minute defaults are blockers.

Run `node scripts/run/check-agent25-external-design-proof.mjs --run-dir runs/<site-id> --write`; `gate-results/agent25-external-design-proof.json` must pass before Agent 3 can start.

After the winning option is selected, Agent 2.5 must inventory every selected-design image slot in `selected-design/image-slots.md`. If there are no image slots, both `image-slots.md` and `asset-manifest.json` must explicitly say so. If image slots exist, Agent 2.5 must continue the external GPT/design-model interaction and request independent standalone image assets for each slot. Cropping, extracting, tracing, or cutting assets from option screenshots, target screenshots, final screenshots, or QA screenshots is forbidden.

The asset request prompt must be saved as `selected-design/asset-generation-prompt.md`. The resulting `selected-option-assets.zip`, `asset-manifest.json`, extracted assets, retry evidence, and any fallback/waiver must be recorded before Design Package Gate. Run `node scripts/qa/check-selected-assets.mjs --run-dir runs/<site-id> --write`; `gate-results/selected-assets.json` must pass before Agent 3 can start.

## Phase 2.6: Design Package Gate

Agent 5 runs in Design Package Gate mode. It reviews the selected design package before implementation and runs Usability QA before visual approval. It must verify `gate-results/agent25-external-design-proof.json`, interaction state semantics, post-selection independent selected-asset evidence, `gate-results/selected-assets.json`, and the executable asset quality gate.

Agent 5 must also run the toolsite design-review subset gate: `node scripts/qa/check-toolsite-design-review.mjs --run-dir runs/<site-id> --write`. This is not the full `/design-review` workflow; it mechanically checks the parts that matter for tool sites: first impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel. `gate-results/toolsite-design-review.json` must pass before Agent 3 can start.

## Phase 3: Static visual restoration

Agent 3 creates a static visual restoration prototype from the approved design package, runs it locally, and captures desktop/mobile screenshots from the actual rendered page.

Agent 3 must not implement calculator functionality, SEO sections, FAQ, schema, sitemap, production indexing, or deployment. The only goal is to make the rendered screenshots match the selected design target at 90% or higher.

## Phase 3.5: Visual Restoration Gate

Agent 5 runs in Visual Restoration Gate mode. It compares Agent 3 rendered screenshots against the Agent 2.5 selected design target.

Agent 4 cannot start until desktop and mobile visual match scores are at least 90%, unless the user explicitly approves an exception. The mechanical screenshot comparison is `node scripts/qa/check-visual-restoration-similarity.mjs --run-dir runs/<site-id> --write`; `gate-results/visual-restoration-similarity.json` must pass before Agent 4 can start.

The 90% visual match gate does not override usability. If a selected design creates numeric overflow, unreadable build rows, dirty thumbnails, cropped food images, no-op controls, `No` clearing actions with portion/size controls, impossible mutually exclusive states, meal-format behavior that conflicts with quick presets, or unusable controls, Agent 5 must route back to Agent 2.5 instead of approving restoration.

## Phase 4: Astro implementation

Agent 4 implements the site in Astro using Agent 3 output. It must not redesign the approved UI.

Functionality is added after the visual gate. SEO metadata, SEO content sections, FAQ, schema, sitemap, and robots logic are added after the visual gate and must not disturb the visual lock.

Agent 4 may implement only pages approved by the Agent 2 Page Plan. If Agent 4 wants to add an unplanned page, it must write a proposal and stop instead of implementing it.

## Phase 5: QA

Agent 5 runs again in Final QA mode and checks:

- Desktop UI screenshot vs actual implementation
- Mobile UI screenshot vs actual implementation
- Agent 2.5 selected design vs actual implementation
- SEO metadata
- Structured data
- Tool behavior
- Primary task-flow interaction behavior
- Accessibility basics
- Build success
- Noindex/index rules
- Sitemap/robots rules
- Toolsite Page Plan compliance: required pages exist, rejected pages do not exist, optional pages have Agent 2 reasons, sitemap contains approved pages, and robots.txt is valid
- Content quality

After Final QA passes, the workflow must stop for human launch approval. Agent 5 must not start Agent 6, deploy, push production, change Cloudflare/DNS/analytics/indexing, or make any production environment change.

## Phase 6: Production launch

Agent 6 runs only after:

- Agent 5 Final QA passed
- `approval.md` is completed
- The current chat contains explicit user approval to launch, such as `批准上线`
- Cloudflare zone is active
- Domain nameservers already point to Cloudflare

Agent 6 produces a complete launch report.
