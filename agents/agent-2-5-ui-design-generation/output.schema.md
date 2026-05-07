# Output Schema

Required outputs:

- `design-generation-prompt.md`
- `design-manifest.md`
- `generated-designs/`
- `selected-design/`
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
