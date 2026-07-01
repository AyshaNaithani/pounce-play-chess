## Changes

### 1. Stop the idle bounce on pieces
- In `src/styles.css`, remove the `cat-idle` keyframe animation (or make it a no-op) so pieces sit still on their squares.
- Keep `cat-pop` (move landing) and `cat-capture-fx` (capture burst) intact — the user only asked to stop the constant idle motion, not the move feedback.
- In `src/components/CatChess.tsx`, drop the `cat-idle` class from the piece `<img>` so nothing animates while pieces are resting.

### 2. Add an explicit Game Mode selector
Right now, mode is implicit: "2 Players" is hidden inside the difficulty buttons. Split it into two clear controls in the right sidebar of `src/components/CatChess.tsx`:

- **Mode card** (new, above the current Opponent card):
  - Two big pill buttons: `👥 Play with a Friend` and `🤖 Play vs Computer`.
  - Selecting "Friend" forces difficulty to `off` and hides the difficulty picker.
  - Selecting "Computer" restores the last chosen AI level (defaulting to `easy` if none), and reveals the difficulty picker.
- **Difficulty card** (existing `DifficultySelect`, trimmed):
  - Remove the `2 Players` option — mode now handles that.
  - Keep `Kitten (easy) / Cat (medium) / Tiger (hard)` as the three difficulty levels, only shown in Computer mode.
- Persist both `catChess.mode` and `catChess.difficulty` in localStorage so refresh keeps the user's setup.
- AI still plays Black; status line still shows "Cat AI is thinking…" only in Computer mode.

No changes to chess rules, board, timers, theme toggle, or captured/history panels.

### Files touched
- `src/components/CatChess.tsx` — remove idle class, add `ModeSelect`, adjust `DifficultySelect`, add mode state + localStorage.
- `src/styles.css` — remove `cat-idle` keyframes/utility.
