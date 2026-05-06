# Local Codex Operating Guide

## How to run an agent manually

1. Open this repository in the IDE.
2. Open the current run folder under `runs/<site-id>/`.
3. Open the relevant agent folder under `agents/`.
4. Give Codex the agent `prompt.md`, input schema, output schema, checklist, and current run folder.
5. Ask Codex to write outputs only into the current run folder.
6. Review the output before moving to the next agent.

## Recommended prompt wrapper

```txt
You are executing Agent <N> for Toolsite Agent Factory.
Read:
- agents/<agent-folder>/prompt.md
- agents/<agent-folder>/input.schema.md
- agents/<agent-folder>/output.schema.md
- agents/<agent-folder>/checklist.md
- runs/<site-id>/input.md
- any previous agent outputs in runs/<site-id>/

Write outputs only to:
- runs/<site-id>/<agent-output-folder>/

Do not perform production deployment unless the current agent is Agent 6 and approval.md is completed.
```

## Stop conditions

Stop and write an issue note in `runs/<site-id>/issues.md` when:

- Required input is missing.
- The domain is not active in Cloudflare for Agent 6.
- QA fails in a way that requires redesign or implementation changes.
- The rendered UI does not match Agent 3 screenshots.
