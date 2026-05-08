# Human Review Points

## Purpose

Lists where future runs must stop for user inspection.

## Required Human Points

1. Three GPT options
   - Agent: 2.5
   - Evidence: `chat-delivery/options-board.png`
   - Block: no implementation before explicit current-chat user choice in formal projects.

2. Selected option record
   - Agent: 2.5
   - Evidence: `chat-delivery/option-selection.md`
   - Block: no hidden option switch.

3. GPT target vs final coded page screenshots
   - Agent: 5 Final QA
   - Evidence: `chat-delivery/final-screenshot-delivery.md`
   - Block: Agent 6 cannot start.

4. Production approval
   - Agent: 6
   - Evidence: `approval.md`
   - Block: no deploy until every checkbox is checked.

## Timeout Rule

Formal projects do not use the 3-minute default.

The 3-minute default is allowed only for `test` or `dry-run` and must be recorded in `external-design-proof.json` plus `option-selection.md`.
