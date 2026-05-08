# Component Spec

## Option C - Night Calibration

- Header: compact brand, two utility anchors, no account/login/premium items.
- TypingTestShell: first viewport work surface with controls, metrics, passage, input, progress, and actions.
- DurationSegmentedControl: five exclusive buttons; active state changes visible chip fill and resets if changed during a running test.
- ModeSelector: four exclusive buttons: Words, Sentences, Practice, Numbers.
- DifficultySelector: three exclusive buttons: Easy, Standard, Advanced.
- MetricStrip: Time, WPM, CPM, Accuracy, Mistakes, Progress. Values reserve room for `625 CPM`, `100%`, and `48`.
- PassageRenderer: real HTML text, split into spans for current/correct/incorrect/extra states. Current character has underline plus contrasting pill background.
- TypingInput: multiline textarea with clear focus ring and helper line.
- ProgressBar: deterministic horizontal track with percentage label.
- ActionButtons: Restart and New passage always visible in first viewport.
- ResultSummary: appears in-place below the input or replaces the passage area after completion; no modal.
- ExplanationSections and FAQ: below first viewport only; full-width text bands, not nested cards.

No bitmap or photo slots are part of this direction.