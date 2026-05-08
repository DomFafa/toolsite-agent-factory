# Interaction State Model

## States

- `idle`: passage loaded, input focused, timer shows selected duration, WPM/CPM/mistakes are zero, accuracy is 100%, progress is 0%.
- `running`: first typed character starts timer; live metrics update from elapsed time and character comparison.
- `complete`: timer reaches zero or passage is completed; input stops accepting new characters and result summary appears in-place.
- `review`: same visual surface shows final WPM, raw WPM, CPM, accuracy, mistakes, duration, mode, and Try again action.

## Controls

- Duration is mutually exclusive: `30 sec`, `1 min`, `2 min`, `3 min`, `5 min`. Selecting a new duration resets the test.
- Mode is mutually exclusive: `Words`, `Sentences`, `Practice`, `Numbers`. Selecting a new mode resets and loads a matching local passage.
- Difficulty is mutually exclusive: `Easy`, `Standard`, `Advanced`. Selecting a new difficulty resets and loads matching local text.
- Restart clears input and metrics but keeps the same passage and settings.
- New passage clears input and metrics and chooses a different local passage.
- There are no no-op controls and no fixed word-count mode.