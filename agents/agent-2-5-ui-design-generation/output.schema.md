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
    code/
    design-rationale.md
    screenshots/
      desktop.png
      mobile.png
  option-b/
  option-c/
```

`selected-design/` must contain:

- `code/`
- `screenshots/desktop.png`
- `screenshots/mobile.png`
- `selection-rationale.md`

`design-manifest.md` must record:

- External LLM/design surface used
- Whether UI references were provided
- Design generation mode: `reference-guided` or `open-exploration`
- Generated options
- Selected option
- Local preview command or file path
- Screenshot paths
- Known implementation risks
- Any hard blocker and required next action
