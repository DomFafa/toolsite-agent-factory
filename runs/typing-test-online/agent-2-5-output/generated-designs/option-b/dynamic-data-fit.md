# Dynamic Data Fit

## Option B - Focus Ledger

Stress values accounted for:

- Time: `05:00`, `00:00`
- WPM: `0` through `220`
- CPM: `0` through `1,100`
- Accuracy: `100%`, `0%`, optional detail `99.5%`
- Mistakes: `0` through `999`
- Progress: `0%` through `100%`
- Long labels: `Advanced`, `Practice`, `New passage`, `The timer starts when you type the first character.`

Fit rules:

- Metric values use tabular figures and fixed minimum cells.
- Controls wrap instead of shrinking below readable targets.
- Passage area has a stable min height; long passages scroll inside the passage region after the first viewport.
- Result details use a responsive grid and never overlay the typing input.
- Mobile prioritizes Time, WPM, Accuracy, and input visibility; secondary metrics remain visible in the grid without horizontal scrolling.