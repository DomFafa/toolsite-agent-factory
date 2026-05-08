# Tool Spec

## Core Tool

The site provides an online typing test that calculates typing speed and accuracy in the browser.

## Decisions

- V1 is a static browser tool with local passages and browser-only scoring.
- V1 prioritizes timed English typing tests over account features, leaderboards, and exam-specific modes.
- V1 is timed-test only. Fixed word-count test modes are explicitly deferred.
- Default scoring uses standard five-characters-per-word WPM math.

Default test:

- Duration: 60 seconds
- Passage mode: common English words or short practical prose
- Difficulty: standard
- Start behavior: timer starts on first valid typed character
- End behavior: test ends when time reaches zero or the passage is completed

## Required Controls

V1 controls visible in the first viewport:

- Duration segmented control: `30 sec`, `1 min`, `2 min`, `3 min`, `5 min`
- Passage mode selector: `Words`, `Sentences`, `Practice`, `Numbers`
- Difficulty selector: `Easy`, `Standard`, `Advanced`
- Restart button
- New passage button

Optional V1 controls if implementation remains simple:

- `Show mistakes` toggle
- `Strict mode` toggle that blocks progression until the current character is corrected

Do not implement account login, teacher dashboards, cloud result saving, leaderboards, paid plans, external text APIs, or server-verified certificate links.

## Test Area

The passage area should render each character or word with state:

- Untyped
- Current
- Correct
- Incorrect
- Extra typed character

The typing input should be obvious and accessible. It may be a textarea or an invisible input paired with a rendered passage, but it must support paste prevention only if clearly handled in code. Do not break standard keyboard behavior on mobile.

## Metrics

Live metrics:

- Time remaining
- WPM
- CPM
- Accuracy
- Mistakes
- Progress

Post-test results:

- Final WPM
- Raw WPM
- CPM
- Accuracy
- Correct characters
- Incorrect characters
- Correct words
- Mistakes
- Duration
- Passage mode
- Clear call to action: `Try again`

## Scoring Rules

Use transparent standard typing-test scoring:

- `grossWpm = typedCharacters / 5 / elapsedMinutes`
- `netWpm = max(0, (typedCharacters - incorrectCharacters) / 5 / elapsedMinutes)`
- `cpm = correctCharacters / elapsedMinutes`
- `accuracy = correctCharacters / max(typedCharacters, 1) * 100`
- `mistakes = incorrectCharacters`
- Display WPM as rounded integer.
- Display CPM as rounded integer.
- Display accuracy to nearest whole percent during test and one decimal in result details if desired.

Use elapsed time for live metrics and selected duration for final metrics when the timer expires. If a user completes the passage early, use actual elapsed time.

## State Flow

1. `idle`: passage is loaded, metrics show defaults, input focused.
2. `running`: first typed character starts timer.
3. `complete`: timer expires or passage ends.
4. `review`: results panel is visible with restart/new passage options.

Restart behavior:

- Reset input and metrics.
- Keep selected duration/mode/difficulty.
- Load the same passage unless the user selects `New passage`.

New passage behavior:

- Reset input and metrics.
- Pick a different bundled passage from the selected mode and difficulty.

## Passage Data

Use original or public-domain-safe local text. Do not copy protected sample passages from the reference site.

Recommended bundled categories:

- Common words: high-frequency English words.
- Sentences: practical workplace and study sentences.
- Practice: balanced punctuation and capitalization.
- Numbers: numeric strings, dates, simple codes.

V1 copy should be neutral global English. Do not include regional exam, language, or local-market references.

## Accessibility

- Tool must be keyboard-first.
- Input focus should be visible.
- Color highlights must not be the only signal; include underline, shape, or contrast changes.
- Results should be announced in normal DOM text, not canvas-only rendering.
- Do not trap keyboard focus.
- Respect reduced motion.

## Error and Edge Cases

- Empty input before first character should keep timer idle.
- Backspace should update metrics.
- Changing duration or mode during a running test should prompt a reset or reset immediately with clear state.
- On mobile, keep the input and current text visible above the keyboard where possible.
- If localStorage is used for optional last-result history, failure should not block the test.

## Agent 3 Handoff

Implement as static frontend only. Keep scoring functions testable and separate from rendering. Include small deterministic passage fixtures so Agent 4 can verify known WPM/accuracy scenarios.

## Assumptions

- Agent 3 can use local constants or JSON for passage data.
- Browser timer precision is sufficient for this utility.
- Optional local result history is acceptable only through `localStorage` and must not be required for the core test.
