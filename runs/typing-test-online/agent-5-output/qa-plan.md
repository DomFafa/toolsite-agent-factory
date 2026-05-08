# Agent 5 QA Plan - typing-test-online

Run date: 2026-05-08

## Scope

QA covers the GPT-derived `Option A — Benchmark Console` implementation for `typing-test-online.com`.

## Acceptance Criteria

- First viewport is the usable typing test.
- Timed tests support 30 sec, 1 min, 2 min, 3 min, and 5 min.
- Modes: Words, Sentences, Practice, Numbers.
- Difficulty: Easy, Standard, Advanced.
- Timer starts on first typed character.
- Live WPM, CPM, accuracy, mistakes, and progress update while typing.
- Character states distinguish current, correct, and incorrect text without relying only on color.
- Restart and New passage reset the right state.
- Paste/drop/bulk input is blocked or safely handled.
- Mobile `390x844` has no horizontal overflow and reaches the passage/input area.
- SEO title, description, canonical, FAQ, sitemap, robots route, and safe default noindex are present.
- No India/local-market/exam/language-specific claims.
- No backend, login, database, API keys, leaderboard, copied reference assets, or server-verified certificate links.

## Evidence

Final evidence is recorded in:

- `qa-report.md`
- `qa-run-log.md`
- `qa-screenshots/`
