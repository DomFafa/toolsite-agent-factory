# Lessons Learned

## Purpose

Captures the failures this Golden Example prevents in future tool-site runs.

## Lessons

1. GPT option images are not optional.
   - Block: Agent 2.5 cannot proceed without showing 3 options in the current chat.

2. External design actions need an evidence runner receipt.
   - Block: Agent 3 cannot start when GPT evidence is only Codex-written markdown or when artifacts changed after `action-receipt.json`.

3. User choice is a gate.
   - Block: no silent default unless 3 minutes pass without response.

4. Selected assets are a separate stage.
   - Block: Agent 3 cannot start before selected-assets evidence passes.

5. Do not crop from GPT mockups.
   - Block: image assets must be standalone generated/user-provided files.

6. No-image designs still need evidence.
   - Block: `image-slots.md`, `asset-manifest.json`, and `asset-acquisition-report.md` must say `Required image slots: none`.

7. Pretty UI is not enough.
   - Block: Agent 5 runs toolsite design-review subset before visual restoration.

8. Agent 3 similarity must be mechanical.
   - Block: written visual scores are not enough.

9. Final screenshots must return to chat.
   - Block: Agent 6 cannot start without target and final screenshot delivery record.

10. Production approval is human-owned.
   - Block: Agent 6 waits for every `approval.md` checkbox.
