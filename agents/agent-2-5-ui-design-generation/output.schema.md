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
- `downloads/selected-option-assets.zip` unless a hard external blocker or user-approved waiver is recorded
- `asset-manifest.json` copied or extracted from the selected option asset zip
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

Agent 3 must compare against target screenshots derived from the external design response. Locally fabricated targets without raw external provenance are not acceptable.

`chat-delivery/` must contain the user-visible option selection record:

- `options-board.png` showing all three GPT-generated options in one review image, or a side-by-side board assembled from the three GPT option screenshots.
- `option-selection.md` with `Decision: PASS`, the three option names, evidence that the board was sent to the current chat, the user-selected option, or the exact 3-minute timeout/default decision.

Agent 2.5 must stop after sending the three options to the current chat. It may proceed only after the user chooses an option, or after 3 minutes without a user response, in which case it must select the GPT-recommended option and record the timeout in `option-selection.md`.

`asset-acquisition-report.md` must record:

- Selected option name
- External design surface used
- Exact post-selection asset request prompt path
- Whether `selected-option-assets.zip` was downloaded
- Zip path and extracted asset paths
- Required image slots from `asset-quality-contract.md`
- Missing or replaced image slots
- Asset quality gate command and result
- Retry count and retry reasons
- Whether fallback assets were used
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
- Post-selection high-resolution asset pack status, including `selected-option-assets.zip`, `asset-manifest.json`, retry evidence, and fallback/waiver status
- Readability and touch-target assessment
- Local asset inventory and asset license/source notes
- Whether generated frontend code is complete, partial, or blocked
- Local preview command or file path
- Screenshot paths
- Known implementation risks
- Functionality deferred until after visual restoration gate
- SEO deferred until after visual restoration gate
- Any hard blocker and required next action
