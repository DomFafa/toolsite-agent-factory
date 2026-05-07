# Output Schema

Required outputs:

- `design-generation-prompt.md`
- `design-manifest.md`
- `generated-designs/`
- `selected-design/`
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
- `design-tokens.md`
- `component-spec.md`
- `asset-plan.md`
- `restoration-rules.md`
- `forbidden-deviations.md`
- `screenshots/desktop.png` when code is runnable
- `screenshots/mobile.png` when code is runnable
- `selection-rationale.md`

`design-manifest.md` must record:

- External LLM/design surface used
- Whether UI references were provided
- Design generation mode: `reference-guided` or `open-exploration`
- Generated options
- Selected option
- Visual restoration target, default `90%`
- Codability assessment
- Local asset inventory and asset license/source notes
- Whether generated frontend code is complete, partial, or blocked
- Local preview command or file path
- Screenshot paths
- Known implementation risks
- Functionality deferred until after visual restoration gate
- SEO deferred until after visual restoration gate
- Any hard blocker and required next action
