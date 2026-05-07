# Run Folder Lifecycle

## Initial state

A new run begins with:

```txt
runs/<site-id>/
  input.md
  state.json
  approval.md
  issues.md
  agent-2-5-output/
```

## Intermediate outputs

Each agent writes to its own output folder. Later agents may read earlier outputs but should not overwrite them unless explicitly retrying the same agent.

## Retry policy

Retries create subfolders:

```txt
agent-2-5-output/
  generated-designs/
  selected-design/
agent-3-output/
  attempt-001/
  attempt-002/
  final.md
```

The accepted attempt should be referenced in `state.json`.

## Completion

A run is complete when:

- Agent 5 Final QA passed
- Agent 6 launch report exists
- Final production URL is recorded
- Sitemap and indexing submissions are recorded
- Cloudflare Web Analytics is confirmed
