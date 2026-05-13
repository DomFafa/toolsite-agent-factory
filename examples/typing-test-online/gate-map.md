# Gate Map

## Purpose

Maps each gate to the failure it blocks.

## Gates

| Gate | Required Before | Blocks |
| --- | --- | --- |
| `web-access-preflight.json` | Agent 2.5 | Using stale or missing web-access flow |
| `external-design-evidence/action-receipt.json` | Agent 3 | Codex self-signed external GPT evidence, stale screenshots, or hash-mismatched artifacts |
| `agent25-external-design-proof.json` | Agent 3 | Codex-local GPT option boards, local target screenshots, fake selected design packages, formal-project 3-minute defaults |
| `agent25-lineage.json` | Agent 3 | Local fake GPT targets |
| `selected-assets.json` | Agent 3 | Cropped, missing, or undocumented selected assets |
| `toolsite-design-review.json` | Agent 3 | Pretty-but-bad UX and AI-template UI |
| Design Package Gate report | Agent 3 | Non-codable or weak selected design |
| `visual-restoration-similarity.json` | Agent 4 | Agent 3 visual match claims without screenshot diff |
| Visual Restoration Gate report | Agent 4 | Static restore below 90% or usability regression |
| `final-visual-lock.json` | Agent 6 | Final page layout drift |
| `final-visual-similarity.json` | Agent 6 | Final page below 90% target similarity |
| `rendered-assets.json` | Agent 6 | Broken or invisible rendered assets |
| `tool-spec.json` | Agent 6 | Tool behavior missing required spec fields |
| `final-qa-evidence.json` | Agent 6 | Incomplete QA evidence bundle |
| `approval.md` | Agent 6 | Production launch without human approval |

## Rule

If a gate writes JSON, later agents must require the JSON pass result, not only a Markdown report.
