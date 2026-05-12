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

## Human review event protocol

Every run uses a single append-only human review event file:

```txt
runs/<site-id>/human-review-events.jsonl
```

When Codex reaches a human review point, it must append an open `human_review` event to this file and then pause for the user's reply. Codex must not continue past the blocked phase until the user reply required by that review point has been received in the current workflow.

Each JSONL line must use this field structure:

```json
{
  "schema_version": "human-review-event.v1",
  "type": "human_review",
  "review_type": "agent25_option_selection",
  "id": "agent25-option-selection",
  "site_id": "<site-id>",
  "run_dir": "runs/<site-id>",
  "phase": "agent-2.5",
  "agent": "agent-2.5-ui-design-generation",
  "status": "open",
  "blocking": true,
  "blocks": "agent-3",
  "title": "Choose UI option",
  "message": "Please choose Option A, Option B, or Option C. Codex must not choose for you.",
  "expected_reply": "Reply with: Choose Option A / Choose Option B / Choose Option C / Reject all and regenerate: ...",
  "attachments": [
    {
      "label": "Options board",
      "path": "agent-2-5-output/chat-delivery/options-board.png",
      "kind": "image",
      "required": true
    }
  ],
  "created_at": "ISO-8601",
  "created_by": "codex"
}
```

Required fields are `schema_version`, `type`, `review_type`, `id`, `site_id`, `run_dir`, `phase`, `agent`, `status`, `blocking`, `blocks`, `title`, `message`, `expected_reply`, `attachments`, `created_at`, and `created_by`. Attachment paths are relative to the run directory. The event `message` field is the exact user-facing text that Hermes may forward. Hermes is not responsible for explaining, summarizing, rewriting, or adding recommendations to this message.

This stage only defines the event protocol. Hermes polling, Telegram delivery, event resolution automation, and gate-script enforcement are separate later work.

For `agent25_option_selection`, the human review must include a visible UI image. Text summaries, markdown files, image paths, option-summary files, or local HTML boards without an exported image do not count as reviewable UI options.

Codex must write `human_review` events at these review points:

| Review point | `review_type` | `id` | Blocks | Required user reply |
| --- | --- | --- | --- | --- |
| Pre-Agent2 SPEC confirmation | `pre_agent2_spec_confirmation` | `pre-agent2-spec-confirmation` | Agent 2 | Confirm the Toolsite SPEC or request changes. |
| Agent2 brief compliance exception | `agent2_brief_exception` | `agent2-brief-exception` | Agent 2.5 | Only when machine compliance fails or is uncertain: approve continuing, send Agent2 back for changes, request the detailed brief, or stop. |
| Agent2.5 UI Option A/B/C selection | `agent25_option_selection` | `agent25-option-selection` | Agent 3 / implementation flow | Choose Option A, B, or C, or reject all options with instructions. |
| Selected Assets / Design Package Gate exception confirmation | `selected_assets_design_package_exception` | `selected-assets-design-package-exception` | Agent 3 / Agent 4, depending on where the exception occurs | Approve the exception, request rework, or stop. |
| Final QA launch approval | `final_qa_launch_approval` | `final-qa-launch-approval` | Agent 6 | Explicitly approve launch, such as `批准上线`, or decline launch. |
| Agent6 blocked or error stop | `agent6_blocked` | `agent6-blocked-<reason-slug>` | Production launch completion | Confirm the blocker is handled and Codex may continue, or stop. |

When Codex is waiting at a human review point, it may manually resolve that point from Hermes inbox:

```bash
node scripts/run/resolve-human-review-from-hermes-inbox.mjs --run-dir runs/<site-id>
node scripts/run/resolve-human-review-from-hermes-inbox.mjs --run-dir runs/<site-id> --write
```

The command reads `runs/<site-id>/human-review-events.jsonl` and `/Users/dom/agents/hermes-toolsite-monitor/hermes-home/state/toolsite-inbox.jsonl`. The default mode is a dry run and must not modify files. With `--write`, Codex appends a new `status: "resolved"` `human_review` event to the run event file. It must not modify the previous open event, must not modify Hermes inbox, must not continue the next workflow phase automatically, and must not bypass the current human review decision.

If there is exactly one current open review in the run, Codex may use the newest unconsumed Hermes inbox message whose `created_at` is at or after that open event's `created_at`. If there are multiple current open reviews, the Hermes inbox message must include the target review id using `review:<review-id>`, for example `review:agent25-option-selection Choose Option B`. Consumed inbox messages are tracked by `inbox_message_key` in resolved events and must not be reused.

## Mobile-controlled production run

For a remote production run, keep the computer-side orchestrator running and use Telegram only for human decisions:

```bash
npm run run:toolsite -- --run-dir runs/<site-id> --remote
```

To create a production run from Telegram intake, the user must first send a fresh Telegram message after the command starts. The message must include a production-start intent phrase such as `开始正式建站`, `新建 production run`, `创建生产站`, `开始生产运行`, or `正式开始这个站`, and it must include all five intake fields. Codex must not create a production run from historical Hermes inbox messages by default:

```bash
npm run run:toolsite -- --from-hermes-intake --remote
```

If there is no fresh intake, Codex exits with `WAITING_FOR_FRESH_INTAKE` and creates no run. If the latest intake is old, Codex exits with `STALE_INTAKE_REJECTED`. If the message lacks production-start intent, Codex exits with `MISSING_PRODUCTION_START_INTENT`. If the target run directory already exists, Codex exits with `RUN_ALREADY_EXISTS`; it must not auto-rename or overwrite the run. `--allow-existing-intake` is the explicit override for using an older intake, and `--resume-existing-run` is the explicit override for resuming a non-aborted existing run.

Production runs created from Hermes intake must write `run-meta.json` with `run_type: "production"`, `deployable: true`, `status: "active"`, `source: "hermes-intake"`, `intake_message_key`, `intake_created_at`, and `run_created_at`.

If the Hermes intake includes image attachments, Codex must copy those real local files into `runs/<site-id>/input-assets/`, record their Telegram provenance in `run-meta.json`, and list the run-local paths in `input.md` so later design agents can use them. If the intake text asks to use an attached image but Hermes provides no attachment metadata, Codex must stop with `MISSING_REQUIRED_ATTACHMENT` and must not pretend the image was read.

When the run is waiting at a human review point, Codex can consume the latest valid Hermes inbox reply and continue to the next workflow step:

```bash
npm run continue:human-review -- --run-dir runs/<site-id>
```

Supported mobile replies are intentionally short:

- `确认 SPEC` confirms `pre-agent2-spec-confirmation` and allows Agent2 to start.
- `修改：...` records a change request and keeps the run blocked before the next agent.
- `A`, `B`, `C`, `Option A`, `Option B`, or `Option C` resolves Agent2.5 option selection and preserves the selected option for Agent3.
- `重发`, `resend`, or `force` resends the Agent2.5 option image review without entering Agent3.
- `确认部署` is only valid for deployable production runs after `check:gates --before agent-6` and gate evidence integrity pass.

The orchestrator must stop at the next open `human_review`. It must not skip gates, must not auto-confirm reviews, must not deploy smoke runs, and must not modify Hermes inbox. Smoke runs remain useful for pipeline checks but are blocked from Agent6 deployment gates.

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

The SPEC must also pass a specificity check. It is not enough to restate generic tool-site language such as "quickly complete a calculation/checking task", "core results are prominent", or "use repository standard constraints". The substantive sections must preserve the current tool's five elements, the important Pre-Agent2 Q&A answers, the target keyword/domain, the chosen UI and UX references, and the user's extra constraints.

For a `word counter` run, the SPEC must explicitly describe the word counter behavior instead of a generic utility. It must include plain text input, real-time statistics, words, characters, sentences, paragraphs, reading time, speaking time, local browser processing, the Stripe UI direction, the `wordcounter.net` UX reference, and the confirmed non-goals such as no login/account/database/AI rewrite/spelling check/grammar check/history.

Run `node scripts/qa/check-pre-agent2-toolsite-spec.mjs --run-dir runs/<site-id> --write`; `gate-results/pre-agent2-toolsite-spec.json` must pass before Agent 2 can start.

If any condition is missing, Codex must stop and output exactly:

```txt
Pre-Agent2 Toolsite SPEC Gate is not complete. Agent2 is blocked.
```

If the SPEC exists but is too generic, Codex must stop and output exactly:

```txt
Toolsite SPEC is too generic. Agent2 is blocked.
```

The Pre-Agent2 Telegram loop must run this specificity check before it sends the SPEC confirmation card. If the generated SPEC is too generic, it must not ask the user to confirm that SPEC.

The Telegram SPEC review card is a user-facing artifact and must be Chinese-first. It may keep necessary product terms such as `word counter`, `Stripe`, `wordcounter.net`, metric names, and URL paths, but it must not forward whole English sentences from `toolsite-spec.md` as the review content.

For faster dry-runs, Codex may run `scripts/run/pre-agent2-telegram-loop.mjs` with `--answers-file runs/<site-id>/pre-agent2-answers.md`. The batch file may answer Q1-Q12, but it must use the same reply validation as Telegram, must not bypass the specificity or SPEC quality checks, and must only produce an open SPEC confirmation review. It must not auto-confirm the SPEC or start Agent2.

## Phase 2: Build brief

Agent 2 receives:

- Confirmed Toolsite SPEC
- Passing `gate-results/pre-agent2-toolsite-spec.json`

It produces product, SEO, content, tool specs, and a UI reference dossier for Agent 2.5.

The confirmed Toolsite SPEC is the user's primary Agent2 input and review artifact. Agent2 output files are machine working documents by default:

- `agent-2-output/site-brief.md`
- `agent-2-output/tool-spec.md`
- `agent-2-output/content-plan.md`
- `agent-2-output/seo-plan.md`
- `agent-2-output/ui-reference-dossier.md`
- `agent-2-output/design-generation-input.md`

Codex must not write a default `agent2_brief_review` human review event and must not send the full Agent2 brief to the user for routine approval.

Agent 2 must also produce a Toolsite Page Plan table in `page-plan.md` or `content-plan.md`:

```txt
page | type | status | reason | implementation owner
```

Allowed page statuses are `required`, `optional-recommended`, `optional-not-needed`, and `rejected`. Every formal tool site must include `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt` as `required`. Agent 2 may recommend optional SEO/support pages, but must give a reason. `/login`, `/dashboard`, `/account`, `/pricing`, `/leaderboard`, `/api`, and `/blog` are rejected unless the current user explicitly requests them.

Run `node scripts/qa/check-page-plan.mjs --run-dir runs/<site-id> --write`; `gate-results/page-plan.json` must pass before Agent 2.5 can start.

After Agent2 finishes, run the Agent2 Brief Compliance Check:

```bash
node scripts/run/check-agent2-brief-compliance.mjs --run-dir runs/<site-id> --write
```

This writes:

- `agent-2-output/brief-compliance-summary.md`
- `gate-results/agent2-brief-compliance.json`

The compliance check must verify:

1. Agent2 required outputs exist.
2. `gate-results/page-plan.json` passed.
3. Agent2 documents preserve the confirmed SPEC keyword, target domain, UI direction, UX direction, and non-goals.
4. The Page Plan does not approve pages that the SPEC did not approve.
5. Agent2 did not introduce obvious unapproved features such as login, account, dashboard, pricing, API, upload, history, or AI rewrite.
6. Agent2.5 may start only when the compliance check passes.

When `agent2-brief-compliance.json` passes, Codex writes no human review event and does not disturb the user. Agent2.5 preflight may continue.

When the compliance check fails or is uncertain, Codex must write an open `agent2_brief_exception` event instead of a default brief review. Its `message` must be a short checklist, not the full brief:

```txt
Agent2 Brief Compliance Summary

1. 是否符合已确认 SPEC：是/否/不确定
2. 是否新增未批准功能：是/否
3. 是否新增未批准页面：是/否
4. 是否保留 UI/UX 方向：是/否/不确定
5. Page Plan Gate 是否通过：是/否
6. 是否可以进入 Agent2.5：是/否

偏离点：
- ...
```

## Phase 2.5: UI design generation

Before Agent 2.5 starts, run `node scripts/run/check-web-access.mjs --run-dir runs/<site-id> --write`. The pipeline is blocked unless the repo-local `web-access/` skill files and relative script paths pass this preflight.

Agent 2.5 uses `web-access` to generate UI design directions and implementation-ready design packages through the ChatGPT web UI or another approved design generation surface.

This step is mandatory even when no UI references are provided.

The default restoration target is 90%. Agent 2.5 must request codable and usable UI output: target screenshots, design tokens, component specs, usability contract, interaction-state model, dynamic data fit notes, UX self-audit, asset plans, asset-quality contract, restoration rules, forbidden deviations, and frontend code when available.

Agent 2.5's GPT prompt must explicitly require: Astro + HTML/CSS/vanilla JS restoration, 90% screenshot similarity, first viewport as the real tool, no dynamic-data overflow, usable mobile layout, complete interaction states, no pretty-but-unusable UI, and no UX sacrifice for visual impact.

Agent 2.5 must prove the options and selected design came from GPT or an approved external design surface. It must save `external-design-evidence/external-response.md`, `conversation-screenshot.png`, `source-provenance.md`, `selected-design-lineage.md`, and `external-design-proof.json`. The proof must map Option A/B/C, `chat-delivery/options-board.png`, the selected option, desktop/mobile targets, and selected package back to the GPT response or GPT option source images. Local HTML/CSS option boards, manual mocks, reconstructed screenshots, locally generated targets, Codex-local packages, and formal-project 3-minute defaults are blockers.

Agent 2.5 UI Option Selection is blocked unless `agent-2-5-output/chat-delivery/options-board.png` exists as a real reviewable image and the open `agent25-option-selection` human review event attaches that file with `kind: "image"`. Agent 2.5 must not write a resolved option selection, must not enter Agent 3, and must not treat pure text Option A/B/C descriptions as formal UI review. If no reviewable option image exists, Codex must stop and output:

```txt
Agent2.5 UI Option Selection is blocked because no reviewable UI images were generated.
```

Run `node scripts/run/check-agent25-option-images.mjs --run-dir runs/<site-id> --write`; `gate-results/agent25-option-images.json` must pass before Agent 3 can start.

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
