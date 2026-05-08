# Interaction State Model

## Option A — Benchmark Console

- `idle`: passage loaded, input enabled, timer at selected duration, WPM/CPM/mistakes zero, accuracy 100%, progress 0%.
- `running`: first input starts timer; status pill reads Running; metrics update every 250ms.
- `complete`: timer hits zero or passage is complete; input disabled; status pill reads Complete.
- `reset`: duration/mode/difficulty changes reset input, timer, metrics, and active controls.
- `restart`: clears current attempt while keeping selected duration, mode, and difficulty.
- `new passage`: advances passage index and clears current attempt.
- `correct`, `wrong`, and `current` character states render inline inside the passage.
