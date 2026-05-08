# Output Schema

Required outputs:

- `design-generation-prompt.md`
- `design-manifest.md`
- `generated-designs/`
- `selected-design/`
- `external-design-evidence/`
- `chat-delivery/`
- `asset-acquisition-report.md`
- `design-generation-report.md`

`generated-designs/` must contain at least three options unless a hard external blocker is recorded:

```txt
generated-designs/
  option-a/
    target/
      desktop.png
      mobile.png
    code/
    assets/
    design-tokens.md
    component-spec.md
    usability-contract.md
    asset-quality-contract.md
    interaction-state-model.md
    dynamic-data-fit.md
    ux-self-audit.md
    asset-plan.md
    restoration-rules.md
    forbidden-deviations.md
    design-rationale.md
    screenshots/
      desktop.png
      mobile.png
  option-b/
  option-c/
```

`selected-design/` must contain:

- `target/desktop.png`
- `target/mobile.png`
- `code/` when complete generated code is available
- `assets/` when local visual assets are needed
- `downloads/selected-option-assets.zip` for every selected image slot, unless `image-slots.md` and `asset-manifest.json` explicitly declare that the selected option has no image slots, or a hard external blocker/user-approved waiver is recorded
- `asset-manifest.json` copied or extracted from the selected option asset zip
- `image-slots.md` listing every selected-design image slot, or explicitly recording `Required image slots: none`
- `asset-generation-prompt.md` when any selected image slot exists, containing the post-selection GPT/design-model prompt for standalone assets
- `fallback-illustration-report.md` when fallback generated illustrations/assets are used after GPT asset pack failure or waiver
- `design-tokens.md`
- `component-spec.md`
- `asset-plan.md`
- `usability-contract.md`
- `asset-quality-contract.md`
- `interaction-state-model.md`
- `dynamic-data-fit.md`
- `ux-self-audit.md`
- `restoration-rules.md`
- `forbidden-deviations.md`
- `screenshots/desktop.png` when code is runnable
- `screenshots/mobile.png` when code is runnable
- `selection-rationale.md`

`external-design-evidence/` must contain raw provenance for the GPT/design-model step:

- `external-response.md` with the verbatim or exported external model response used to create the design directions
- `conversation-screenshot.png` or an equivalent screenshot of the external design surface showing the generated response
- `source-provenance.md` mapping each generated option and the selected target screenshots/code to the external response, with any Codex normalization/local edits explicitly identified
- `selected-design-lineage.md` proving the selected design package came from the selected GPT option
- `external-design-proof.json` with:
  - `mode`: `production`, `test`, or `dry-run`
  - `approvedDesignSurface`: ChatGPT/GPT/OpenAI or another approved external design surface
  - `externalResponse.path`, `kind`, and `sha256`
  - `conversationScreenshot.path`, surface, and `sha256`
  - three `options[]` entries for Option A/B/C with GPT source, option image path, and `sha256`
  - `optionsBoard.path`, GPT source-image provenance, board `sha256`, and the three option image hashes used
  - `selection.selectedOption` and current-chat user selection source
  - `targets.desktop` and `targets.mobile` mapped to the selected GPT option
  - `selectedDesignPackage.sourceOption`, GPT/external source, and `codexLocalCreation: false`

Agent 3 must compare against target screenshots derived from the external design response. Locally fabricated targets without raw external provenance are not acceptable.

`chat-delivery/` must contain the user-visible option selection record:

- `options-board.png` showing all three GPT-generated options in one review image, or a side-by-side board assembled from the three GPT option screenshots.
- `option-selection.md` with `Decision: PASS`, the three option names, evidence that the board was sent to the current chat, and the user-selected option.

Agent 2.5 must stop after sending the three options to the current chat. Formal projects may proceed only after the user chooses an option in the current chat. A 3-minute timeout/default is allowed only in `test` or `dry-run` mode and must be recorded in `option-selection.md`.

Run before Agent 3:

```bash
node scripts/run/check-agent25-external-design-proof.mjs --run-dir runs/<site-id> --write
```

This writes `gate-results/agent25-external-design-proof.json`. Agent 3 is blocked unless it passes.

`asset-acquisition-report.md` must record:

- Selected option name
- External design surface used
- Exact post-selection asset request prompt path
- `image-slots.md` path and every selected-design image slot
- Whether independent standalone assets were requested from GPT/design model after option selection
- Confirmation that no asset was cropped, extracted, or traced from `target/desktop.png`, `target/mobile.png`, option screenshots, final screenshots, or QA screenshots
- Whether `selected-option-assets.zip` was downloaded
- Zip path and extracted asset paths
- Required image slots from `asset-quality-contract.md`
- Missing or replaced image slots
- `selected-assets` gate command and result
- Asset quality gate command and result
- Retry count and retry reasons
- Whether fallback generated illustrations/assets were used, with `selected-design/fallback-illustration-report.md` and `Decision: PASS`
- Any hard blocker and required next action

`design-manifest.md` must record:

- External LLM/design surface used
- Whether UI references were provided
- Design generation mode: `reference-guided` or `open-exploration`
- Generated options
- Selected option
- Visual restoration target, default `90%`
- Codability assessment
- Usability assessment
- Interaction state assessment, including starter defaults, clearing behavior, mutually exclusive options, and no-op controls
- Dynamic data fit and overflow risk assessment
- Thumbnail/image text assessment
- Asset quality assessment, including source sizes, aspect ratio fit, subject fill, white-margin risk, and `asset-quality-gate` result when assets are wired
- Post-selection independent selected-asset status, including `image-slots.md`, `asset-generation-prompt.md`, `selected-option-assets.zip`, `asset-manifest.json`, `gate-results/selected-assets.json`, retry evidence, and fallback/waiver status
- Readability and touch-target assessment
- Toolsite design-review subset readiness, including first impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel
- Local asset inventory and asset license/source notes
- Whether generated frontend code is complete, partial, or blocked
- Local preview command or file path
- Screenshot paths
- Known implementation risks
- Functionality deferred until after visual restoration gate
- SEO deferred until after visual restoration gate
- Any hard blocker and required next action
