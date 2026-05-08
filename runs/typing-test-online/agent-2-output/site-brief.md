# Site Brief

## Identity

- Site ID: `typing-test-online`
- Target domain: `typing-test-online.com`
- Primary keyword: `typing test online`
- Language: English
- Site type: static browser-based typing speed test
- V1 constraints: no backend, no login, no database, no API keys, no server scoring, no protected reference copy, no copied brand assets

## Product Goal

Build a fast, trustworthy, independent typing speed test that opens directly into a usable test. The first viewport must contain the typing passage, input area, timer, WPM, CPM, accuracy, mistake count, progress, mode controls, and restart action. Supporting SEO content can sit below the tool, but the site must not begin with a marketing hero.

## Decisions

- The homepage is the primary tool page for `typing test online`.
- V1 will ship as a static browser-only typing test.
- The first viewport must prioritize the usable typing interface over marketing or long SEO copy.
- Product positioning is `professional benchmark + practice feedback`.
- V1 supports timed tests only. Fixed word-count tests are deferred.
- V1 should avoid account, leaderboard, database, or server-side certificate verification features.
- V1 should prefer a no-bitmap-asset design direction using HTML text, CSS, and simple SVG/iconography only when needed.

## Audience

Primary audience is global English-language search traffic looking for a quick online typing test, typing speed test, WPM test, and practice workflow. V1 must avoid regional exam, language, or local-market references.

Key user jobs:

- Check current typing speed in WPM and CPM.
- Practice short timed tests repeatedly.
- Compare accuracy and mistakes after a session.
- Use a simple online typing test without signup.
- Choose common test durations and passage modes.

## Search Intent

The primary search intent is utilitarian and immediate: users want to start typing and see speed results. The page should satisfy `typing test online`, `typing test`, `typing speed test`, `online typing test`, `typing test practice`, and `wpm test` without forcing reading before use.

Intent priorities:

1. Start a typing test instantly.
2. Understand WPM, CPM, accuracy, and mistake scoring.
3. Practice again with a different time or passage.
4. Learn small improvement tips after seeing results.

## Source Inputs Used

- Run input: `runs/typing-test-online/input.md`
- User-supplied keyword: `typing test online`
- Reference inspection through `web-access` CDP:
  - `https://stripe.com/`
  - `https://www.speedtypingonline.com/typing-test`

## Demand Decisions

Agent 1 keyword research is waived for this run because the user supplied the keyword directly. V1 should proceed from `typing test online` and should not include regional targeting.

Keyword clusters to support in V1:

- `typing test`
- `typing speed test`
- `online typing test`
- `typing test practice`
- `wpm test`
- `words per minute test`

Keyword clusters to defer:

- Regional exam-specific and non-English typing modes. These need separate local exam/layout research before implementation.
- Typing games. Demand is large, but the product shape is different from a utility test.

## First Viewport Requirements

The first viewport should be the working test interface:

- Compact top bar with brand/domain and minimal navigation.
- Main test panel with passage text and typing input.
- Live metrics: time remaining, WPM, CPM, accuracy, mistakes, progress.
- Controls visible without scrolling: duration, passage type, difficulty, restart.
- Clear focus state and instruction line inside the tool surface.
- No marketing hero, large decorative headline, or buried start button.

Recommended first viewport hierarchy:

1. Small brand line: `Typing Test Online`
2. Tool heading: `Typing Test Online`
3. Controls row
4. Live metrics row
5. Passage area
6. Typing input
7. Restart/new passage controls

## Content Tone

Use precise, calm, direct utility language. Avoid hype. The tool should feel professional and reliable, not game-like by default.

Voice examples:

- "Start typing to begin the timer."
- "Your WPM updates as you type."
- "Restart test"
- "New passage"
- "1 minute"
- "Practice mode"

## Static-Only Implementation Assumptions

- All passages are bundled as local static data.
- Results are computed in the browser.
- Optional history can use `localStorage` only if Agent 3 keeps it simple and clearly non-account-based.
- Cloudflare Web Analytics can be included as a production script placeholder only when configured by the project.
- No server calls are required for the core test.

## Handoff Notes

Agent 2.5 should design a first-screen tool experience, not a landing page. The selected design should feel Stripe-quality and professional while avoiding Stripe trade dress, and should preferably require no local bitmap assets. Agent 3 should implement the visual restoration before functionality. Agent 4 should later test typing flow, metric correctness, restart behavior, mobile usability, and SEO metadata.
