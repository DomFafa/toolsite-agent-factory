# Component Spec

## Option A — Benchmark Console

First viewport is the usable typing test, not a marketing hero.

- Header: brand mark `T`, brand text `Typing Test Online`, compact page nav.
- Intro row: eyebrow `Browser benchmark`, H1, support line, and run status pill.
- Duration segmented control: 30 sec, 1 min, 2 min, 3 min, 5 min.
- Passage mode segmented control: Words, Sentences, Practice, Numbers.
- Difficulty segmented control: Easy, Standard, Advanced.
- Metrics: Time, WPM, CPM, Accuracy, Mistakes, Progress in six equal desktop blocks and compact three-column mobile layout.
- Passage shell: metadata line plus large character-highlighted passage area.
- Typing input: visible textarea directly under passage.
- Actions: Restart and New passage.

States required: idle, running, reset, restarted, new passage, complete, correct char, wrong char, current char. The current character has underline/background treatment and mistakes use background plus inset mark, not color alone.
