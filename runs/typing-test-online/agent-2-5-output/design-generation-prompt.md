# Design Generation Prompt

## External Design Brief

You are generating implementation-ready UI design directions for `typing-test-online.com`, a static browser-based typing speed test. The output will be restored by Codex in Astro using HTML, CSS, and vanilla JavaScript. The default visual restoration target is 90% screenshot similarity between the selected design target and the rendered implementation.

Use references only within these boundaries:

- Stripe: visual mood only, especially crisp typography, dense-but-breathable spacing, restrained depth, and professional SaaS polish. Do not copy Stripe layout, gradients, brand assets, navigation, text, or trade dress.
- SpeedTypingOnline typing test: functional coverage only, especially timed test workflow, live WPM/accuracy feedback, restartable practice, and character-level highlighting. Do not copy layout, sample passages, account features, protected text, ads, or dated styling.

## Product Scope

- Positioning: professional benchmark + practice feedback.
- V1 is timed-test only. Do not include fixed word-count tests.
- Global English only. No regional exam, language, or local-market elements.
- Static frontend only: no backend, login, database, API keys, leaderboard, server persistence, paid plans, or server-verified certificate links.
- Prefer no bitmap/image assets. Use HTML text, CSS, stable layout, and simple inline SVG/iconography only when useful.
- Functionality and SEO work are deferred until after the selected visual design passes the visual restoration gate.

## First Viewport Requirements

The first viewport must be the usable typing tool, not a marketing hero. Include:

- Header with brand `Typing Test Online`.
- H1 `Typing Test Online`.
- Support line: `Start typing to measure WPM, CPM, accuracy, and mistakes.`
- Duration segmented control: `30 sec`, `1 min`, `2 min`, `3 min`, `5 min`.
- Passage mode selector: `Words`, `Sentences`, `Practice`, `Numbers`.
- Difficulty selector: `Easy`, `Standard`, `Advanced`.
- Live metrics: Time, WPM, CPM, Accuracy, Mistakes, Progress.
- Large passage display with current/correct/incorrect states.
- Typing input.
- Restart and New passage buttons.

Use this original placeholder passage, or another original non-copied passage of similar length:

`Steady practice builds speed. Focus on each word, keep a calm rhythm, and correct mistakes before they become habits.`

## Usability Requirements

- Usability comes before visual polish.
- Design for realistic dynamic values: `00:00`, `125 WPM`, `625 CPM`, `100%`, `48 mistakes`, `100%`, and long mode/difficulty labels if future copy expands.
- Minimum desktop body/control label target: 12px. Minimum mobile label target: 14px unless secondary metadata.
- Desktop click targets should be at least 32px. Mobile tap targets should be at least 44px where space permits.
- Controls must have visible effects. No no-op controls.
- Changing duration, mode, or difficulty while running should reset the test with clear state.
- Restart resets input and metrics while keeping selected duration/mode/difficulty.
- New passage resets input and metrics and loads a different bundled passage.
- Optional toggles must affect visible state or be omitted.
- Current character and mistakes must not rely on color alone; use underline, border, shape, or background changes.
- Mobile must keep passage and input readable and avoid keyboard-covering sticky controls.
- Avoid cards inside cards and generic Tailwind/SaaS template patterns.

## Required Output Per Direction

Generate at least three distinct desktop/mobile UI directions. Each direction must include:

- Desktop and mobile design targets.
- Design tokens with concrete values.
- Component and layout specs.
- Usability contract.
- Asset-quality contract.
- Interaction state model.
- Dynamic data fit notes.
- UX self-audit.
- Asset plan.
- Restoration rules.
- Forbidden deviations.
- Runnable frontend code when possible.
- Short rationale and codability notes.

If the selected design uses no image slots, the selected asset-quality contract and asset acquisition report must explicitly state: required image slots: none; `selected-option-assets.zip` is not required because the selected design contains no image slots.