# Design Generation Input

## Objective

Design the first production UI direction for `typing-test-online.com`, a static online typing test. The first viewport must be a usable typing test, not a marketing hero.

## Decisions

- Design generation should produce a tool-first interface.
- Product, SEO, content, and scoring scope are already defined by Agent 2 and should not be rewritten.
- The visual system should be polished and restrained, with no copied reference branding.
- Product positioning is professional benchmark plus practice feedback.
- V1 is timed-test only. Do not introduce fixed word-count modes in the selected V1 design.
- V1 must be global English. Do not include regional exam, language, or local-market references.
- Prefer a no-bitmap-asset design system. Use real HTML text, CSS, layout, state styling, and simple inline SVG/iconography only when needed.

## Assumptions

- The implementation target is static frontend code.
- Agent 2.5 can propose visual structure, spacing, states, and components, but not backend features.
- Any generated design must remain responsive and accessible on mobile.
- Account features, server persistence, leaderboards, and server-verified certificates are out of scope.

## Product Summary

Users arrive from search and want to measure typing speed immediately. The interface should let them choose a duration, start typing, see live WPM/CPM/accuracy/mistakes/progress, restart quickly, and review a clear result after the test.

## Design Mode

Reference-informed design, not open exploration. Use:

- Stripe for polished mood only.
- SpeedTypingOnline for feature coverage only.

Do not copy visual layout, copy, logos, brand assets, sample passages, or exact trade dress from either reference.

## First Viewport Composition

Required above the fold:

- Small header with `Typing Test Online`.
- H1: `Typing Test Online`.
- One short support line.
- Duration controls.
- Passage mode controls.
- Live metrics: Time, WPM, CPM, Accuracy, Mistakes, Progress.
- Large passage display.
- Typing input.
- Restart and New passage controls.

The tool should be ready to use immediately. Supporting SEO content starts below the first viewport.

## Visual Direction

Target mood:

- Modern utility.
- Crisp and trustworthy.
- High-precision typography.
- Layered but restrained depth.
- Subtle gradients or accent washes are acceptable, but avoid direct Stripe-like gradient imitation.
- Professional enough for students, job seekers, and office users.
- Data-interface quality: the active tool should feel precise, calm, and trustworthy, not like a marketing page.

Avoid:

- Marketing hero layout.
- Huge decorative headline that pushes the test down.
- Game-like neon styling.
- Dated portal layout.
- Single-hue purple/blue dominance.
- Cards inside cards.
- Login or premium UI.
- Regional exam-specific UI.
- Certificate verification or server-backed result validation.
- Photo or bitmap hero assets unless absolutely necessary.

## Suggested Layout

Desktop:

- Constrained page width.
- Top header.
- Main tool arranged as a strong central work surface.
- Metrics in a compact grid above or beside the passage.
- Controls in a single readable row with wrapping support.
- Results panel appears below or replaces the passage area after completion.
- Below-tool content appears as full-width sections or clean text bands.

Mobile:

- Header stays compact.
- Controls wrap into two rows.
- Metrics become a tight two-column or horizontal scroll-free grid.
- Passage and input remain visible and readable.
- Avoid sticky elements that cover the keyboard area.

## Component Requirements

Design components:

- `Header`
- `TypingTestShell`
- `DurationSegmentedControl`
- `ModeSelector`
- `DifficultySelector`
- `MetricStrip`
- `PassageRenderer`
- `TypingInput`
- `ProgressBar`
- `ActionButtons`
- `ResultSummary`
- `ExplanationSections`
- `FAQ`

## Content To Place

Use exact first-screen text:

- Brand: `Typing Test Online`
- H1: `Typing Test Online`
- Support: `Start typing to measure WPM, CPM, accuracy, and mistakes.`
- Helper: `The timer starts when you type the first character.`
- Buttons: `Restart`, `New passage`

Use sample passage placeholder text that is original, such as:

`Steady practice builds speed. Focus on each word, keep a calm rhythm, and correct mistakes before they become habits.`

## Color Guidance

Use a balanced palette with:

- Neutral light base.
- Dark readable text.
- One primary accent for current progress.
- One success color for correct input.
- One error color for mistakes.
- One warm or green secondary accent to avoid a one-note blue/purple palette.

## Accessibility Requirements

- Visible keyboard focus.
- Strong text contrast.
- Non-color error states.
- Reduced motion support.
- Large enough touch targets.
- No text overlap at small widths.

## Agent 2.5 Deliverable Expectations

Produce a design handoff that Agent 3 can implement as static frontend code. Do not change product scope, SEO strategy, scoring model, or content strategy. If proposing visual variants, all variants must keep the usable typing test in the first viewport.

If the selected design uses no image slots, record that clearly in `asset-acquisition-report.md` and `asset-quality-contract.md` so the post-selection asset step is satisfied as a no-assets case rather than silently skipped.

## Downstream Handoff

Agent 3 should implement the selected design as a static browser tool with local passage data and browser-only scoring.

Agent 4 should QA:

- First viewport usability.
- Typing start/end flow.
- Metric calculations.
- Restart/new passage.
- Responsive layout.
- Accessibility basics.
- No backend/login/API dependency.
