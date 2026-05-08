# Final QA Example

## Purpose

Defines what Agent 5 Final QA must prove before Agent 6.

## Required Gates

Run or verify:

```bash
npm run build
node scripts/qa/check-final-visual-lock.mjs --run-dir runs/<site-id> --url <preview-url> --write
node scripts/qa/check-final-visual-similarity.mjs --run-dir runs/<site-id> --write
node scripts/qa/check-rendered-assets.mjs --run-dir runs/<site-id> --url <preview-url> --write
node scripts/qa/check-tool-spec.mjs --run-dir runs/<site-id> --write
node scripts/qa/check-final-qa-evidence.mjs --run-dir runs/<site-id> --write
```

Also require existing pass results:

- `gate-results/selected-assets.json`
- `gate-results/toolsite-design-review.json`
- `gate-results/visual-restoration-similarity.json`

## Screenshot Delivery

Agent 5 must send to current chat:

- GPT selected target screenshot
- Final coded page screenshot

Record:

```txt
agent-5-output/chat-delivery/final-screenshot-delivery.md
```

## Blocks

- Final page drifting from GPT target
- Tool behavior missing required spec
- Broken rendered assets
- Missing screenshot delivery to chat
- Missing final QA evidence bundle
- Agent 6 starting before human approval

## Agent 6 Rule

Agent 6 starts only when every `approval.md` checkbox is checked.

