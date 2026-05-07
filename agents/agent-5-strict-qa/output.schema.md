# Output Schema

Required outputs:

- `design-package-gate-report.md` when run in Design Package Gate mode
- `visual-restoration-gate-report.md` when run in Visual Restoration Gate mode
- `qa-report.md`
- `qa-screenshots/`
- `fix-routing.md`

Each output should include decisions, assumptions, and next-agent handoff notes.

Design Package Gate outputs must record:

- Generated options reviewed
- Selected design reviewed
- Desktop/mobile design targets
- Design tokens reviewed
- Component spec reviewed
- Asset plan reviewed
- Restoration rules reviewed
- Codability score
- Visual quality score
- Tool-fit score
- Mobile usability score
- Reference usage assessment
- Copy/brand safety assessment
- Pass/fail decision
- Required changes if failed

Visual Restoration Gate outputs must record:

- Agent 2.5 target screenshots reviewed
- Agent 3 rendered screenshots reviewed
- Desktop visual match score out of 100
- Mobile visual match score out of 100
- Overall visual match score out of 100
- Required threshold: 90
- Pass/fail decision
- Visual deviations by module
- Whether functionality remains deferred
- Required changes if failed
