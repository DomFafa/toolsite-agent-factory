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
- Usability score
- Data-fit score
- Mobile usability score
- UX interaction flow score
- Numeric overflow assessment
- Thumbnail and preset image text assessment
- Asset quality gate result
- Post-selection high-resolution asset acquisition status
- Selected option asset zip path, manifest status, retry evidence, and fallback/waiver status
- Food image source size, aspect ratio, blur/upscaling, and white-gutter assessment
- Build/tool panel readability assessment
- Food image crop assessment
- Click/tap target assessment
- Primary interaction state assessment, including meal formats, presets, toggles, clearing behavior, and impossible states
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
- Usability deviations by module, including overflow, readability, thumbnail cleanliness, image cropping, and control sizing
- Interaction deviations by module, including no-op controls, inconsistent presets vs meal formats, and mutually exclusive state failures
- Asset quality deviations by module, including low source resolution, blurred upscaling, white gutters, or embedded raster SVGs
- Whether functionality remains deferred
- Required changes if failed
