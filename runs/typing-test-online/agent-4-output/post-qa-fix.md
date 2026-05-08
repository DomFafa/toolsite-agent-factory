# Post-QA Fix

Date: 2026-05-08

## Issue Fixed

Agent 5 found that paste-like full-passage input could complete the typing test instantly with impossible scores such as `1920 WPM`, `9600 CPM`, and `Elapsed time 0:00`.

## Change

- Added paste and drop prevention on the typing textarea.
- Added bulk input detection for one-event insertions over 8 characters.
- Reverts suspicious bulk input to the previous typed value.
- Shows a visible warning: `Pasting and bulk text insertion are disabled so WPM stays tied to real typing.`
- Keeps the test active instead of completing when bulk input is blocked.

## Verification

- `npm_config_cache=../agent-5-output/npm-cache npm run build` passed with `0 errors`, `0 warnings`, and `0 hints`.
- `npm_config_cache=/Users/dom/Desktop/库/toolsite-agent-factory/runs/typing-test-online/agent-5-output/npm-cache bash scripts/qa/run-local-qa.sh runs/typing-test-online/site` passed.
- Browser/CDP check confirmed a full-passage one-event insertion now reverts to the prior 6-character typed value, keeps the textarea enabled, sets state to `Paste blocked`, and does not complete the test.
- Browser/CDP paste event from an empty test leaves input length at `0`, keeps WPM at `0`, and shows the paste-block warning.
- Screenshot evidence: `runs/typing-test-online/agent-5-output/screenshots/post-fix-desktop.png`.

## Remaining Risks

- Formal Agent 2.5 selected-design artifacts and visual restoration screenshots are still absent, so strict production visual QA remains blocked unless the user waives that pipeline gate.
- `npm audit --audit-level=moderate` still reports 5 moderate vulnerabilities through the Astro check dependency chain. The suggested fix is breaking and was not applied.
