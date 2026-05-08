# Human Review Points

## Purpose

Lists where future runs must stop for user inspection.

## Required Human Points

1. Three GPT options
   - Agent: 2.5
   - Evidence: `chat-delivery/options-board.png`
   - Block: no implementation before user choice or 3-minute timeout.

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

If the user does not choose an option within 3 minutes, Agent 2.5 may select GPT's recommended option.

It must still record the timeout and selected option.

