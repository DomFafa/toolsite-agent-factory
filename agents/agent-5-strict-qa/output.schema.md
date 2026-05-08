# Output Schema

Required outputs:

- `design-package-gate-report.md` when run in Design Package Gate mode
- `visual-restoration-gate-report.md` when run in Visual Restoration Gate mode
- `qa-report.md`
- `qa-screenshots/`
- `chat-delivery/final-screenshot-delivery.md` before Agent 6
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
- Toolsite design-review subset result under `gate-results/toolsite-design-review.json`
- First impression, AI slop, tool-first trunk test, visual hierarchy/scan order, mobile tool usability, and interaction feel assessment
- Numeric overflow assessment
- Thumbnail and preset image text assessment
- Asset quality gate result
- Post-selection independent selected-asset gate result under `gate-results/selected-assets.json`
- Post-selection high-resolution asset acquisition status
- Selected image slots inventory path under `agent-2-5-output/selected-design/image-slots.md`
- Selected option asset zip path, manifest status, independent asset request prompt, retry evidence, and fallback/waiver status
- Confirmation that selected assets were not cropped/extracted from option screenshots, target screenshots, final screenshots, or QA screenshots
- Food image source size, aspect ratio, blur/upscaling, and white-gutter assessment
- Build/tool panel readability assessment
- Food image crop assessment
- Click/tap target assessment
- Primary interaction state assessment, including meal formats, presets, toggles, clearing behavior, and impossible states
- Reference usage assessment
- Copy/brand safety assessment
- Pass/fail decision
- Required changes if failed

Final QA outputs must record:

- Browser-backed final visual lock result path under `gate-results/final-visual-lock.json`
- Target-vs-final page visual similarity result path under `gate-results/final-visual-similarity.json`
- Browser-backed rendered asset visibility result path under `gate-results/rendered-assets.json`
- Tool spec implementation result path under `gate-results/tool-spec.json`
- Post-selection independent selected-asset result path under `gate-results/selected-assets.json`
- Toolsite design-review subset result path under `gate-results/toolsite-design-review.json`
- Agent 3 visual restoration similarity result path under `gate-results/visual-restoration-similarity.json`
- Final QA evidence bundle path under `gate-results/final-qa-evidence.json`
- `chat-delivery/final-screenshot-delivery.md` confirming the GPT target screenshot and final coded page screenshot were sent to the current chat for user inspection

Visual Restoration Gate outputs must record:

- Agent 2.5 target screenshots reviewed
- Agent 3 rendered screenshots reviewed
- Desktop visual match score out of 100
- Mobile visual match score out of 100
- Overall visual match score out of 100
- Required threshold: 90
- Mechanical visual restoration similarity result path under `gate-results/visual-restoration-similarity.json`
- Pass/fail decision
- Visual deviations by module
- Usability deviations by module, including overflow, readability, thumbnail cleanliness, image cropping, and control sizing
- Interaction deviations by module, including no-op controls, inconsistent presets vs meal formats, and mutually exclusive state failures
- Asset quality deviations by module, including low source resolution, blurred upscaling, white gutters, or embedded raster SVGs
- Whether functionality remains deferred
- Required changes if failed
