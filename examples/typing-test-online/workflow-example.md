# Workflow Example

## Purpose

Defines the Agent 2 to Agent 6 order for future tool sites.

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
- Wait for user choice, or default after 3 minutes
- Save selected design package

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

## Agent 6

Starts only after `approval.md` is fully checked.

Blocks:

- Any unchecked production approval item
- Cloudflare/domain/noindex uncertainty

