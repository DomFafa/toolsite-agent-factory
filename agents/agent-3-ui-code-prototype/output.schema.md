# Output Schema

Required outputs:

- `ui-direction.md`
- `prototype-code/`
- `final-screenshots/desktop.png`
- `final-screenshots/mobile.png`
- `visual-diff-report.md`
- `visual-match-score.md`
- `visual-lock.md`
- `implementation-handoff.md`

Each output should include decisions, assumptions, visual deviations from the selected design, and next-agent handoff notes.

`visual-match-score.md` must record:

- Desktop score out of 100
- Mobile score out of 100
- Overall score out of 100
- Whether the required 90% threshold passed
- Evidence screenshot paths
- Remaining deviations

`visual-lock.md` must explicitly state that functionality and SEO are still deferred unless the 90% visual restoration threshold passed.
