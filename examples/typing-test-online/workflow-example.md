# Workflow Example

## Purpose

Defines the Agent 2 to Agent 6 order for future tool sites.

## Run Start Gate

Required before any work:

- Output flow files read
- Output current run phase
- Output next Agent
- Output current-phase forbidden actions

Blocks:

- Silent start without phase or forbidden-action awareness

## Agent 2

Outputs:

- `site-brief.md`
- `tool-spec.md`
- `content-plan.md`
- `seo-plan.md`
- `ui-reference-dossier.md`
- `design-generation-input.md`

Blocks:

- Missing tool behavior
- Missing SEO/content plan
- Missing design input for Agent 2.5

## Agent 2.5

Required:

- Use `web-access`
- Generate 3 GPT options
- Save external provenance
- Send 3-option board to current chat
- Wait for explicit user choice in formal projects
- Save selected design package

## Agent 2.5 External GPT Source Gate

Required before Agent 3:

- `external-response.md` is raw/exported GPT output
- `conversation-screenshot.png` is a real GPT/approved surface screenshot
- `source-provenance.md` maps Option A/B/C, selected option, desktop target, and mobile target
- `selected-design-lineage.md` proves the selected design came from the GPT option
- `options-board.png` is built from GPT option sources
- `option-selection.md` records explicit current-chat user selection for formal projects
- `gate-results/agent25-external-design-proof.json` passes

Blocks:

- Codex-local option boards
- Local HTML/CSS mock boards
- Reconstructed or locally generated targets
- Selected design packages not traced to GPT
- Formal-project 3-minute defaults

## Agent 2.5 GPT Prompt Gate

Required:

- GPT prompt includes Astro + HTML/CSS/vanilla JS restoration
- GPT prompt includes 90% screenshot similarity
- GPT prompt requires first viewport as the real tool
- GPT prompt prevents dynamic-data overflow
- GPT prompt requires mobile usability
- GPT prompt requires complete interaction states
- GPT prompt rejects pretty-but-unusable UI
- GPT prompt forbids sacrificing UX for visual impact

Blocks:

- Silent option selection
- Locally invented target screenshots
- Missing GPT provenance
- Missing selected-design package

## Selected Assets Stage

Required after option selection, before Agent 5 Design Package Gate.

Blocks:

- Cropping assets from GPT screenshots
- Skipping image-slot inventory
- Treating no-image designs as an unstated skip

## Agent 5 Design Package Gate

Required before Agent 3.

Blocks:

- Bad UX hidden behind good visuals
- Missing selected-assets gate
- Missing toolsite design-review subset gate

## Agent 3

Only static visual restoration.

Blocks:

- Functionality work before visual lock
- SEO sections before visual lock
- Visual match below 90%
- Missing mechanical screenshot similarity gate

## Agent 4

Adds:

- Tool functionality
- SEO metadata and content
- Structured data
- Sitemap and robots logic

Blocks:

- Redesigning approved UI
- Breaking first-viewport visual lock

## Agent 5 Final QA

Required:

- Build
- Final visual lock
- Final target-vs-page similarity
- Rendered assets
- Tool spec
- Final QA evidence
- Target and final screenshots sent to chat

Blocks:

- Missing screenshot evidence
- Missing tool behavior
- Missing final evidence bundle

## Post-Final-QA Launch Stop Gate

Required after Final QA passes:

- Stop before Agent 6
- Wait for explicit `批准上线` in the current chat
- Do not deploy
- Do not push production
- Do not change Cloudflare, DNS, analytics, or indexing
- Do not make any production environment change

Blocks:

- Production launch without current-chat approval

## Agent 6

Starts only after `approval.md` is fully checked.

Blocks:

- Any unchecked production approval item
- Cloudflare/domain/noindex uncertainty
