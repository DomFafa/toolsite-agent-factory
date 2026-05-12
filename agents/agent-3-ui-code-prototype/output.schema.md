# Output Schema

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 3 must use only the user-selected Option A/B/C and must not change the selected design direction.

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
- `gate-results/visual-restoration-similarity.json` result path and pass/fail status
- Evidence screenshot paths
- Remaining deviations
- Usability deviations, if any, including overflow, readability, dirty thumbnails, food crop issues, or control sizing issues

`visual-lock.md` must explicitly state that functionality and SEO are still deferred unless the 90% visual restoration threshold passed.
