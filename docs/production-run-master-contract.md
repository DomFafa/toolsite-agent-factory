# Production Run Master Contract

This document is the behavioral constitution for `toolsite-agent-factory` production runs.
All agents, scripts, workers, gates, repair loops, and PR workflows must follow it.

It is not a bug list. It defines how the system must behave from mobile intake to Cloudflare Pages deployment.

## 0. Contract Precedence

This contract is the highest-level behavior contract for production runs.

If this contract conflicts with any agent prompt, workflow document, legacy script behavior, historical run artifact, old gate output, or previous ad-hoc instruction, this contract takes precedence.

Rules:

- Agent prompts must be updated to follow this contract.
- Workflow docs must be interpreted through this contract.
- Legacy scripts must not preserve behavior that violates this contract.
- Historical run artifacts are not precedent.
- Old smoke/test run output must not be used to justify production behavior.
- A confirmed Toolsite SPEC controls product requirements for a specific run, but it must still obey this contract’s system, safety, review, gate, and deployment rules.
- If a script cannot comply with this contract, it must fail clearly instead of continuing with legacy behavior.

## 1. System Purpose

`toolsite-agent-factory` exists to help a local IDE + Codex workflow semi-automatically create Astro static tool sites.

The production target is a lightweight, static, SEO-oriented, visually distinctive tool site that can be generated locally, reviewed remotely through Telegram at critical decision points, and deployed to Cloudflare Pages only after explicit approval.

The user’s goal is to batch-produce small static tool sites with:

- Clear search intent and keyword focus.
- A real first-screen tool experience, not a marketing-only hero.
- Distinct UI direction rather than generic templates.
- Static frontend architecture unless the confirmed SPEC explicitly says otherwise.
- Controlled human review through Telegram.

The user is not an integration tester. The user participates only in key product decisions and approvals. Codex owns orchestration, implementation, gate repair, and evidence collection.

## 2. Role Definitions

### User

The user provides:

- The five intake elements.
- Optional image or visual reference attachments.
- Product decisions when Codex identifies a meaningful gap.
- SPEC confirmation.
- UI option selection.
- Final deployment confirmation.

The user should not need to manually tell Codex to read Hermes inbox, continue the run, rerun gates, or repair ordinary failures.

### Telegram

Telegram is the user-facing input and review surface.

Telegram must show:

- Intake acknowledgements.
- Dynamic product questions.
- SPEC confirmation cards.
- UI option images.
- Pre-deploy approval prompts.
- Clear failure messages when the system cannot continue.

Telegram is not a business logic layer.

### Hermes

Hermes is a relay and attachment transport layer.

Hermes must:

- Preserve user text exactly.
- Preserve captions.
- Download and persist image attachments.
- Write inbox records with attachment metadata.
- Forward messages to Codex-readable storage.
- Send Codex-generated messages or images back to Telegram.

Hermes must not:

- Interpret product requirements.
- Generate questions.
- Decide whether an answer is valid.
- Summarize, rewrite, or advise on the user’s intent.
- Choose UI options or deployment actions.

### Codex

Codex is responsible for understanding and execution.

Codex must:

- Parse intake.
- Validate run freshness and completeness.
- Classify attachment purpose.
- Dynamically ask only meaningful project questions.
- Generate and sanitize Toolsite SPEC.
- Execute Agent stages.
- Generate or request required design artifacts.
- Repair failing gates by changing real artifacts.
- Stop at required human review points.
- Never deploy without explicit production approval.

### Agents

Agent 1 through Agent 6 are stage roles, not independent authorities. They operate under this contract and the confirmed Toolsite SPEC.

### Gate Scripts

Gate scripts verify real artifacts. They are not substitutes for business judgment.

Gate scripts must not be weakened to make a run pass. A passing gate result is meaningful only when grounded in real files, screenshots, source, lineage, and current run state.

## 3. Run Types

### smoke run

A smoke run is a non-deployable run used to validate pipeline behavior.

Rules:

- `run_type = smoke`
- `deployable = false`
- It may test Pre-Agent2, Agent2, Agent2.5, Agent3, or Agent4 behavior.
- It must never enter Agent6 deployment.
- Before Agent6, it must be blocked with a clear message: `Smoke runs are not deployable. Start a production run for Agent6 deployment.`

### production run

A production run is intended to create a deployable site.

Rules:

- `run_type = production`
- `deployable = true`
- It may enter Agent6 only after all required gates pass and the user confirms deployment.

### aborted run

An aborted run is a run that must not continue automatically.

Rules:

- `status = aborted`
- It must include an `abort_reason`.
- Workers and orchestrators must not resume it automatically.
- Resuming requires explicit user direction and a clean decision about whether to reuse or archive it.

### archived run

An archived run preserves historical output.

Rules:

- Archived runs live under `runs/_archived/...`.
- They are read-only reference material unless explicitly restored.
- They must not be scanned as active production runs.

### resumed run

A resumed run is an existing non-aborted run explicitly selected by the user or command.

Rules:

- It must retain its original intake provenance.
- It must not silently consume stale or unrelated inbox messages.
- It must continue from its latest valid state and open human review, if any.

### run metadata

Every run must have `run-meta.json` with at least:

- `run_type`
- `deployable`
- `status`
- `source`
- `run_created_at`
- intake provenance:
  - `intake_message_key`
  - `intake_created_at`
  - attachment provenance when present

## 4. Intake Contract

Production intake requires five complete elements:

1. Keyword / 关键词
2. Target domain / 目标域名
3. UI reference / UI 参考
4. UX reference / UX 参考
5. Extra ideas / constraints / mimic points / 额外想法、限制、模仿点

Rules:

- A production run must not start without all five elements.
- If any element is missing, the system must output `INCOMPLETE_INTAKE` and list missing fields.
- A production run must require explicit start intent, such as:
  - `开始正式建站`
  - `新建 production run`
  - `创建生产站`
  - `开始生产运行`
  - `正式开始这个站`
- Fresh intake is required by default.
- Historical intake must be rejected by default.
- Existing run directories must not be overwritten or auto-renamed.
- If the target run directory exists, the system must stop with `RUN_ALREADY_EXISTS` unless the user explicitly requested resume or archive/reset.
- Images are not one of the five required elements. They are conditional attachments.
- If the intake says to use or reference an image but no image attachment exists, the system must stop with `MISSING_REQUIRED_ATTACHMENT`.

## 5. Attachment / Image Contract

User-uploaded images are design references by default.

When the intake contains phrases such as:

- `参考我发的图`
- `用我发的图`
- `黑白人物插画`
- `附图`
- `截图`
- `插画参考`

the image must be classified as one or more of:

- `design_reference`
- `illustration_reference`
- `visual_reference`

Rules:

- Images must be copied or referenced under `runs/<site-id>/input-assets/`.
- Image provenance must be written to `run-meta.json`.
- Image provenance and usage must be written to `input.md`.
- Agent2 outputs must preserve the image path and intended use.
- `agent-2-output/design-generation-input.md` must include the image path and purpose.
- Agent2.5 must receive the image path as a visual/design input.
- Codex must not ask low-value questions such as:
  - `这张图是什么意思？`
  - `你想怎么用这张图？`
  - `是否要使用这张图片？`
  - `图片放不放页面？`
- If the user already described the image purpose, record it directly.
- For example: `使用 input-assets 中的黑白人物插画作为页面点缀和视觉参考，不抢占第一屏工具主体。`

Only two image-related questions are allowed:

1. The user mentioned an image but no attachment was received. The correct response is `MISSING_REQUIRED_ATTACHMENT`.
2. Multiple images exist and their usage conflicts or cannot be mapped to pages/sections.

## 6. Remote Operation Contract

The remote worker is the production control loop.

Rules:

- Remote operation requires an active local worker process.
- If the worker is not running, Telegram intake may be stored by Hermes but no production flow should be expected to continue.
- It must keep running until stopped by the user, fatal error, or explicit completion.
- It must monitor fresh production intake.
- It must scan active production runs for open `human_review` events.
- It must poll Hermes inbox for replies.
- It must consume valid replies automatically.
- It must continue the run after resolving a review.
- It must stop only at the next human review, fatal error, completion, or user stop.
- It must never silently fail.
- Every success or failure state must be visible in Telegram or logs, and user-impacting failures must be sent to Telegram.
- The same inbox message must never be consumed twice.
- Worker locks must detect stale PID locks and clear them automatically.
- The user should only need to reply in Telegram:
  - `确认 SPEC`
  - `修改：...`
  - `A` / `B` / `C`
  - `确认部署`

The user should not need to tell Codex to read inbox, continue the run, or rerun the worker.

## 7. Dynamic Interview Contract

Fixed generic questionnaires are forbidden in user-facing flows.

Rules:

- No fixed `Question` bank, generic `Q1-Q12`, or template questionnaire may appear in production, remote, smoke, or fallback user flows.
- Codex must perform dynamic gap analysis from:
  - five intake elements
  - reference sites
  - extra constraints
  - image attachments
  - existing answers
- Each question must be project-specific.
- Each turn asks only the single most valuable question.
- Question count is not fixed.
- Simple projects may need zero or one question.
- Complex projects may require many questions.
- The hard cap is 30 questions to prevent infinite loops.
- Codex must not ask for information already provided in the intake.
- Codex must not ask low-value questions to satisfy a target count.
- The user may say `够了，出 SPEC`, but this is not the only stopping condition.
- If Codex determines information is sufficient, it must naturally generate the SPEC.
- Every dynamic question must include or internally record `why_this_question_matters`.

Planner output should include:

- `information_sufficient`
- `missing_decision_areas`
- `next_question`
- `why_this_question_matters`
- `estimated_remaining_questions`

`estimated_remaining_questions` is advisory only.

## 7A. Information Sufficiency Checklist

Codex may generate a Toolsite SPEC only after it has enough information to make the SPEC concrete, product-specific, and safe to send into Agent2.

Before generating a SPEC, Codex must confirm the following decision areas are either known, intentionally defaulted, or explicitly marked as unresolved for user review:

- Tool purpose and primary job-to-be-done.
- Target user and main use case.
- First viewport UX.
- Input model.
- Output/result model.
- Result interpretation and next-step guidance.
- UI direction.
- UX reference behavior.
- Content/page boundaries.
- Explicit non-goals.
- Technical constraints.
- Privacy/data handling constraints.
- Legal, safety, or disclaimer boundaries when relevant.
- Image/attachment usage when attachments exist.
- Success criteria.

Codex must not ask about information already present in the intake, confirmed answers, or attachment purpose. If the missing information is important, Codex asks one project-specific question. If the information is non-critical, Codex may use a safe default and expose it in the SPEC for confirmation.

For finance, retirement, tax, health, legal, nutrition, and similar calculator or advisory-adjacent tools, Codex must explicitly settle or surface:

- Default assumptions.
- Result interpretation.
- Disclaimer boundaries.
- Whether the output is educational, informational, estimate-only, or advice.
- Inputs that materially change the output.
- What the tool must not claim.

For finance and retirement tools, this includes defaults and boundaries such as:

- expected return
- salary increase
- retirement age
- contribution assumptions
- employer match assumptions
- inflation or catch-up contribution handling when relevant
- investment, tax, and financial advice disclaimers

If those areas are not clear enough, Codex must continue dynamic questioning. It must not generate a SPEC merely because five intake elements exist.

## 8. SPEC Contract

The Toolsite SPEC is the user-confirmed product contract. It must contain only website requirements.

The SPEC must not contain internal workflow text, including:

- `需按已确认 SPEC 执行`
- `不能保留英文整句说明`
- `SPEC 审核卡`
- `Agent2`
- `Agent3`
- `gate`
- `human_review`
- `review`
- `confirmation`
- `blocks`
- debug reasons
- run repair notes
- stale run reasons
- generated-before-analysis notes
- fixed generic Pre-Agent2 references

The SPEC must not contain dirty source residue, including:

- encoded URL fragments such as `%EF%BC%9A`
- copied search-result snippets
- source titles
- link-preview residue
- Telegram link preview fragments
- unrelated webpage summaries

Allowed content:

- User-provided reference URLs in `toolsite-spec.md`
- Product terms such as `401K Calculator`, `expected return`, `employer match`, `educational estimate`
- Necessary English product labels

Telegram confirmation cards must be clean user-facing summaries.

Rules:

- Telegram cards must disable link preview when possible.
- Telegram cards should use human-readable source names such as `usa.gov` or `calculator.net 401K Calculator`.
- Telegram cards must not paste long raw URLs with dirty fragments.
- The confirmed `toolsite-spec.md` is the primary factual input to Agent2.

## 9. Agent Contracts

### Agent2

Agent2 turns confirmed SPEC into machine working documents.

Agent2 must:

- Read the confirmed Toolsite SPEC.
- Generate:
  - `agent-2-output/site-brief.md`
  - `agent-2-output/tool-spec.md`
  - `agent-2-output/content-plan.md`
  - `agent-2-output/seo-plan.md`
  - `agent-2-output/ui-reference-dossier.md`
  - `agent-2-output/design-generation-input.md`
- Preserve image attachment paths and purposes.
- Preserve `design_reference` / `illustration_reference` semantics.
- Stay aligned with the SPEC.
- Avoid adding unapproved features, pages, or backend assumptions.

Agent2 output is machine working material by default and is not a routine human approval point.

### Agent2.5

Agent2.5 creates UI options.

Agent2.5 must:

- Generate high-fidelity UI target images.
- Show real first-screen tool UI.
- Include inputs, outputs, navigation or context, and explanatory states.
- Use confirmed image references appropriately.
- Produce an options board that is visually reviewable in Telegram.
- Generate enough target/design package material for Agent3 to restore the selected option.

Agent2.5 must not:

- Use low-fidelity wireframes as final UI options.
- Use text explanation boards as substitutes for UI images.
- Use Codex hand-drawn placeholders while claiming GPT or external generation.
- Enter Agent3 without user option selection.

If the required generation capability is unavailable, Agent2.5 must output `NO_GPT_IMAGE_GENERATION_AVAILABLE` rather than fabricate design provenance.

### Stronger Agent2.5 UI Generation Requirement

For production runs, final Agent2.5 Option A/B/C choices must come from an approved high-fidelity visual generation path.

The approved high-fidelity visual generation path must be explicitly configured or documented before production use.

Allowed final user-selectable UI option sources:

- Approved GPT/image-generation workflow with recorded provenance.
- Approved external visual design generation workflow with recorded provenance.
- Another explicitly approved high-fidelity visual generation path documented for the run.

Not allowed as final user-selectable UI options unless the user explicitly permits that lower-fidelity mode:

- Local HTML/CSS mockups.
- Local SVG boards.
- Markdown summaries.
- Text explanation boards.
- Wireframes.
- Codex-generated layout placeholders.
- Screenshot boards that do not show high-fidelity first-screen product UI.

Those artifacts may be used as internal drafts, planning aids, or implementation scaffolds. They must not be presented to the user as final A/B/C visual choices for a production run.

If no approved high-fidelity generation capability is available, Agent2.5 must stop and return one of:

- `NO_GPT_IMAGE_GENERATION_AVAILABLE`
- `NO_APPROVED_UI_GENERATION_AVAILABLE`

If no approved provider or approved path is configured, Agent2.5 must stop with `NO_APPROVED_UI_GENERATION_AVAILABLE`.

It must not fabricate a high-fidelity claim, and it must not let Agent3 proceed from low-fidelity options.

### Agent3

Agent3 works only from the user-selected option.

Rules:

- It must use the selected Option A/B/C.
- It must not switch to another option.
- It must generate prototype code, screenshots, visual handoff, and restoration guidance.
- It must preserve selected-design intent.

### Agent4

Agent4 implements the Astro static site.

Rules:

- It must create the site under `runs/<site-id>/site/`.
- The first screen must be a working tool.
- It must implement confirmed inputs and outputs.
- It must not introduce backend, database, login, account, API, or saved input behavior unless the SPEC explicitly approves them.

### Agent5

Agent5 performs final QA.

Rules:

- It must run required gates.
- It must repair real artifacts when gates fail.
- It must not fabricate passing JSON.
- It must not lower gate standards.
- It must not ask the user to repair ordinary implementation failures.

### Agent6

Agent6 deploys only after explicit production approval.

Rules:

- Only production runs may enter Agent6.
- Smoke runs must never deploy.
- Agent6 requires passed Agent5, gate evidence integrity, and resolved pre-deploy approval.
- Deployment must not occur without the user replying `确认部署`.

## 10. Human Review Contract

Required human review points:

- Toolsite SPEC confirmation.
- UI Option A/B/C selection.
- Pre-deploy approval.
- Product decisions Codex cannot responsibly choose.
- Irrecoverable or ambiguous failures.

The user should not be asked for:

- Build failures.
- CSS/layout bugs.
- Visual similarity misses.
- Missing planned pages.
- Tool-spec implementation gaps.
- Ordinary content polish.
- Broken local artifacts.

Those are Codex repair responsibilities.

## 11. Gate / Repair Contract

Gate failure means Codex must repair real artifacts and rerun the gate.

Rules:

- Do not edit `gate-results/*.json` by hand to pass.
- Do not lower gate standards.
- Do not write markdown evidence as a substitute for real output.
- Do not bypass gate scripts.
- Every PASS must come from rerunning the gate.
- Repair loops should have a bounded maximum, such as 5 attempts per gate group.
- After the limit, Codex may ask the user only with clear failure evidence and options.
- Gate evidence integrity must protect before-Agent6 flow.

Agent5 repair must be artifact-first:

- Fix site code for site failures.
- Fix CSS/layout for visual failures.
- Regenerate screenshots when screenshots are stale.
- Preserve selected design lineage.
- Preserve option selection evidence.

## 12. UI Generation Contract

A valid UI generation target image is:

- High fidelity.
- Specific to the product.
- A real first-screen page/tool mockup.
- Suitable for frontend restoration.
- Complete enough to guide layout, hierarchy, components, and visual style.
- Clear on desktop and mobile requirements, or explicitly paired with separate desktop/mobile targets.

It must include:

- Real input controls.
- Real result/output area.
- Navigation or page context when relevant.
- Tool-specific copy.
- Trust/legal/helper text where required.
- Confirmed visual reference treatment.

It must not be:

- A wireframe.
- A text-only explanation board.
- A path list.
- A markdown summary.
- A Codex placeholder image.
- A generic SaaS dashboard unrelated to the tool.

Generation provenance must be recorded:

- provider or source
- prompt
- output path
- timestamp
- selected option
- image/reference assets used

If it was not generated by GPT or an external provider, the system must not claim that it was.

## 13. Git / PR Contract

Repository hygiene rules:

- Never commit `runs/`.
- Never commit `.env`.
- Never commit `node_modules/`.
- Never commit secrets, tokens, keys, screenshots, zips, or temporary artifacts unless explicitly intended and safe.
- Never commit Hermes runtime files into the toolsite repo.

PR rules:

- Only create PRs after code fixes are complete and tests pass.
- Do not create one PR per tiny bug during stabilization if the bugs belong to the same blocked main flow.
- Remote main-loop problems should be stabilized on one focused branch.
- The user should not manually run `git add`, `git commit`, `git push`, or PR creation.
- Use the `git-commit-batch-push` skill for safe commit / push / PR closeout.

## 14. Deployment Contract

Deployment is allowed only for production runs.

Rules:

- Smoke runs cannot deploy.
- Production runs require Agent5 Final QA.
- Production runs require gate evidence integrity before Agent6.
- A `pre_deploy_approval` human review must be open before deployment.
- The user must reply `确认部署`.
- Without `确认部署`, Cloudflare Pages deployment must not start.
- Deployment commands must not run during testing, repair, or design review.

## 15. Observability / Failure Contract

The system must never fail silently.

Worker requirements:

- Write `.toolsite-worker/worker.log`.
- Record state in `.toolsite-worker/state.json`.
- Report startup status:
  - worker started
  - inbox path
  - remote mode status
  - last processed key
- Report user-impacting failures to Telegram in Chinese.
- Detect stale locks and clear them.
- Make active run status queryable.

Errors that must be surfaced:

- `RUN_ALREADY_EXISTS`
- `INCOMPLETE_INTAKE`
- `MISSING_REQUIRED_ATTACHMENT`
- `MISSING_PRODUCTION_START_INTENT`
- `STALE_INTAKE_REJECTED`
- unsupported review type
- invalid reply
- gate blocker after repair limit
- missing generation capability

Waiting states must be explainable:

- waiting for fresh intake
- waiting for SPEC confirmation
- waiting for UI option selection
- waiting for deployment approval
- waiting due to fatal blocker

## 16. Testing Contract

The user is not the integration tester.

Codex must use fake Hermes inbox and automated fixtures to validate remote behavior before asking for real Telegram verification.

Fake E2E must cover:

- Fresh production intake with image.
- Intake validation and attachment copy.
- Dynamic questions.
- User reply consumption.
- SPEC confirmation.
- Agent2 progression.
- Agent2.5 option selection.
- Pre-deploy non-deploy path.
- Duplicate inbox prevention.
- Invalid reply handling.
- No automatic confirmation.
- No automatic deployment.

Real user verification should be the final smoke check only.

A failed real user verification must not trigger repeated manual retries. Codex must reproduce the failure with fake Hermes inbox records or local fixtures before asking the user to verify again.

Real verification should confirm:

- Telegram gets feedback.
- No fixed generic questions appear.
- Images enter design input.
- User replies automatically continue the flow.
- Required human review points are respected.

## 17. Backlog Policy

Do not interrupt production site work for non-blocking improvements.

Rules:

- Blocking issues may interrupt current work.
- Non-blocking polish goes to backlog.
- Do not expand test scope just because a nearby issue is found.
- Do not use ordinary optimizations as a reason to stop building the current site.
- Do not repair framework design while a production run is blocked unless the framework issue is the blocker.
- Prefer one focused stabilization branch for related main-loop issues.

Backlog examples:

- Better logs formatting.
- More optional screenshots.
- UI copy polish.
- Additional provider support.
- Expanded test coverage that does not block current flow.

Blocking examples:

- Worker cannot consume replies.
- Production run starts from stale intake.
- SPEC contains internal system instructions.
- UI option image is not a real reviewable design.
- Gate can be passed by forged evidence.
- Deployment can happen without explicit approval.

## 18. Contract Adoption Requirements

The following components must explicitly reference, implement, or enforce this contract:

- `scripts/run/pre-agent2-question-planner.mjs`
- `scripts/run/pre-agent2-telegram-loop.mjs`
- `scripts/run/read-hermes-intake.mjs`
- `scripts/run/run-toolsite-orchestrator.mjs`
- `scripts/run/remote-toolsite-worker.mjs`
- `agents/agent-2-site-brief/prompt.md`
- `agents/agent-2-site-brief/checklist.md`
- `agents/agent-2-site-brief/output.schema.md`
- Agent2.5 image gate
- SPEC sanitizer
- `check-gates` before Agent6

Minimum adoption rules:

- Pre-Agent2 planning must follow the dynamic interview and information sufficiency rules.
- Intake parsing must enforce freshness, explicit production intent, complete five elements, and attachment requirements.
- The orchestrator and worker must enforce human review boundaries and remote reply consumption rules.
- Agent2 must treat the confirmed SPEC and attachment references as authoritative inputs.
- Agent2.5 gates must enforce high-fidelity image requirements for production option selection.
- The SPEC sanitizer must enforce the SPEC Contract before writing `toolsite-spec.md` and before sending Telegram cards.
- Before-Agent6 gates must enforce run type, deployability, pre-deploy approval, and gate evidence integrity.
- Any component that cannot comply must fail with a clear error rather than continue with legacy behavior.
