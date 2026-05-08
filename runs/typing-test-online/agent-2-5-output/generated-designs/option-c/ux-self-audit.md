# UX Self-Audit

## Option C - Night Calibration

- Pretty-but-unusable risk: controlled by keeping the passage and textarea central, large, and above supporting content.
- Numeric overflow risk: low; metric cards reserve enough room for three-digit WPM and four-digit CPM.
- Tiny-control risk: low; segmented controls have explicit min heights and wrap on mobile.
- Inconsistent state risk: low; all selectors are mutually exclusive and reset the run when changed.
- No-op risk: none; every visible control maps to a reset, passage change, setting change, or result action.
- Mobile keyboard risk: moderate; avoid sticky footers and keep input directly below passage.
- Reference-copy risk: low; no copied sample text, brand assets, or exact layouts.
- Asset risk: very low; no local image slots are required.