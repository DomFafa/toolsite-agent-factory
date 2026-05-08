# Local Codex Operating Guide

Standard flow reference: before starting any new toolsite run, Codex must read `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`.

## How to run an agent manually

1. Open this repository in the IDE.
2. Open the current run folder under `runs/<site-id>/`.
3. Open the relevant agent folder under `agents/`.
4. Give Codex the agent `prompt.md`, input schema, output schema, checklist, and current run folder.
5. Ask Codex to write outputs only into the current run folder.
6. Review the output before moving to the next agent.

Before executing any agent work, Codex must output: flow files read, current run phase, next agent, and actions forbidden in the current phase.

## Recommended prompt wrapper

```txt
You are executing Agent <N> for Toolsite Agent Factory.
Read:
- examples/typing-test-online/README.md
- examples/typing-test-online/workflow-example.md
- agents/<agent-folder>/prompt.md
- agents/<agent-folder>/input.schema.md
- agents/<agent-folder>/output.schema.md
- agents/<agent-folder>/checklist.md
- runs/<site-id>/input.md
- any previous agent outputs in runs/<site-id>/

Write outputs only to:
- runs/<site-id>/<agent-output-folder>/

Before doing work, output:
- Flow files read
- Current run phase
- Next agent to execute
- Actions forbidden in the current phase

After Agent 5 Final QA passes, stop. Do not start Agent 6, deploy, push production, change Cloudflare/DNS/analytics/indexing, or make production environment changes until the user explicitly says "批准上线" in the current chat and approval.md is completed.
```

## Stop conditions

Stop and write an issue note in `runs/<site-id>/issues.md` when:

- Required input is missing.
- The domain is not active in Cloudflare for Agent 6.
- QA fails in a way that requires redesign or implementation changes.
- The rendered UI does not match Agent 2.5 selected design or Agent 3 screenshots.
- Final QA has passed but explicit user launch approval is missing.
