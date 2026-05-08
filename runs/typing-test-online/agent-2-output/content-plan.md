# Content Plan

## Page Copy Principles

Keep copy short above the fold. The tool must carry the page. SEO explanations belong below the test.

## Decisions

- First-screen copy is intentionally short so the test is immediately usable.
- Below-tool content explains scoring and practice topics for SEO coverage.
- Passage text should be locally authored or public-domain-safe, not copied from references.

## Assumptions

- English is the only V1 language.
- Regional exam and non-English language copy is deferred until researched.
- V1 copy must stay neutral global English with no regional or local-market references.
- V1 does not claim official certification or server-verified certificate links.
- Agent 3 can store copy in static constants or page markup.

Use clear labels:

- `Time`
- `WPM`
- `CPM`
- `Accuracy`
- `Mistakes`
- `Progress`
- `Restart`
- `New passage`

Avoid:

- Claims about official certification.
- Exam-specific claims not researched.
- Login, account, teacher, or premium copy.
- Any copied reference sample text.

## First Viewport Copy

Brand:

`Typing Test Online`

H1:

`Typing Test Online`

Support line:

`Start typing to measure WPM, CPM, accuracy, and mistakes.`

Idle helper:

`The timer starts when you type the first character.`

Completion helper:

`Review your result, then restart or try a new passage.`

## Tool Labels

Duration:

- `30 sec`
- `1 min`
- `2 min`
- `3 min`
- `5 min`

Modes:

- `Words`
- `Sentences`
- `Practice`
- `Numbers`

Difficulty:

- `Easy`
- `Standard`
- `Advanced`

Buttons:

- `Restart`
- `New passage`
- `Try again`
- `Copy result` if implemented locally through Clipboard API

## Result Copy

Results heading:

`Your typing test result`

Result summary template:

`You typed {wpm} WPM with {accuracy}% accuracy in {duration}.`

Result detail labels:

- `Net WPM`
- `Raw WPM`
- `CPM`
- `Accuracy`
- `Mistakes`
- `Correct characters`
- `Incorrect characters`
- `Duration`
- `Mode`

## Below-Tool Content Outline

### How the typing test works

Explain that users choose a duration and passage, then start typing. The timer begins on first keystroke. Results update live and final results appear when the test ends.

### What WPM means

Explain WPM as words per minute, using five characters as one standard word. Keep wording simple for students and job-practice users.

### What CPM means

Explain CPM as characters per minute, useful for data entry and accuracy-focused practice.

### How accuracy is calculated

Explain correct characters divided by total typed characters. Mention that fewer mistakes improve both accuracy and net WPM.

### Typing practice tips

Tips:

- Keep your eyes on the next word.
- Type at a steady pace before chasing speed.
- Repeat short tests to build consistency.
- Practice punctuation and numbers separately.
- Review mistakes after each test.

### FAQ

Use the questions listed in `seo-plan.md`.

## Passage Content Guidance

Create original text snippets, not copied reference text. Recommended passage sources:

- Original neutral study/work sentences.
- Public-domain-safe generic pangrams.
- Locally authored common word lists.
- Locally authored number/date/code strings.

Avoid song lyrics and protected literary excerpts.

## Agent 3 Handoff

Keep content in local constants or JSON. Ensure passage text has enough variety for multiple restarts and enough length for 5-minute tests by cycling or selecting longer passages.

## Agent 2.5 And Agent 4 Handoff

Agent 2.5 should preserve the short first-screen labels and avoid placing long educational copy above the tool. Agent 4 should check that all visible content is English, non-copied, and consistent with static-only constraints.
