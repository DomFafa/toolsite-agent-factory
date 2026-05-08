# SEO Plan

## SEO Positioning

Primary page: `/`

Primary keyword: `typing test online`

Core promise: a free, instant, browser-based typing test with WPM, CPM, accuracy, mistakes, timed modes, and practice passages.

## Decisions

- Build the homepage around the primary keyword `typing test online`.
- Use the first viewport for the working test, then place SEO explanations below it.
- Target global English-language search intent. Do not include regional exam, language, or local-market targeting in V1.
- Agent 1 keyword research is waived because the user supplied the keyword directly.

## Assumptions

- External keyword validation is waived for this run.
- Production indexing will be approved later; development output should remain noindex.
- V1 is single-page unless the factory later requires static route expansion.

## Metadata Draft

Title:

`Typing Test Online - Free WPM Typing Speed Test`

Meta description:

`Take a free typing test online and check your WPM, CPM, accuracy, mistakes, and progress. Start typing instantly with 30 second to 5 minute practice modes.`

Canonical:

`https://typing-test-online.com/`

Open Graph title:

`Typing Test Online - Free WPM Speed Test`

Open Graph description:

`Measure your typing speed, accuracy, CPM, and mistakes with a fast online typing test. No signup required.`

## Keyword Map

Primary:

- `typing test online`

Secondary:

- `typing test`
- `typing speed test`
- `online typing test`
- `free typing test`
- `typing test practice`
- `wpm test`
- `words per minute test`

Supporting phrases:

- `check typing speed`
- `typing speed online`
- `typing speed practice`
- `1 minute typing test`
- `typing accuracy test`
- `typing test for practice`

Deferred expansion terms:

- `hindi typing test online`
- regional exam-specific typing tests
- non-English typing tests
- `typing game`

## On-Page Structure

Recommended `h1`:

`Typing Test Online`

First viewport copy:

- Short line only: `Start typing to measure WPM, CPM, accuracy, and mistakes.`
- Do not place a long SEO paragraph above the test.

Below-tool sections:

1. `How the typing test works`
2. `What WPM and CPM mean`
3. `How accuracy is calculated`
4. `Typing practice tips`
5. `Common typing test durations`
6. `FAQ`

## FAQ Targets

Draft FAQ questions:

- `What is a good WPM score?`
- `How is WPM calculated?`
- `What is CPM in a typing test?`
- `Does accuracy affect my typing speed score?`
- `How can I improve my typing speed?`
- `Is this typing test free?`
- `Can I use the typing test without signing up?`
- `What is the best duration for typing practice?`

## Schema

Use static JSON-LD:

- `WebApplication`
- `FAQPage`

`WebApplication` fields:

- name: `Typing Test Online`
- applicationCategory: `EducationalApplication`
- operatingSystem: `Any`
- offers: free

Do not add fake ratings, fake reviews, or organization claims.

## Indexing

Development:

- Use `noindex,nofollow`.

Production:

- Change to `index,follow` only after approval.
- Include canonical URL.

## Internal Expansion Plan

V1 should stay single-page unless the factory expects one route. Later static pages can target:

- `/typing-speed-test/`
- `/wpm-test/`
- `/typing-test-practice/`
- `/one-minute-typing-test/`
- `/typing-test/1-minute/`
- `/typing-test/3-minute/`
- `/typing-test/5-minute/`

Do not create regional exam-specific or non-English pages until researched.

## Agent 4 SEO Checks

- H1 exists and matches primary intent.
- Metadata is present.
- Tool appears before long informational content.
- No copied reference text.
- No login-required claims.
- Development build remains noindex.

## Handoff

Agent 2.5 should not redesign SEO strategy. Agent 3 should implement metadata and JSON-LD statically. Agent 4 should verify metadata, canonical, noindex state, and that the tool appears before SEO body copy.
