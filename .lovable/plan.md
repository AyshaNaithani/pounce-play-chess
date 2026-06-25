## Goals

1. Confirm theme toggle instantly refreshes promotion picker + board artwork.
2. Add a subtle idle animation to all cat pieces.
3. Refine the move/capture pop to better suit the chibi art.
4. Persist cat theme and AI difficulty in localStorage.

## Changes

**src/components/CatChess.tsx**
- Verify `PromotionPicker` reads `pieceArt(theme, ...)` from current `theme` state (not a captured prop) so it re-renders the instant the toggle flips. If not, lift the lookup inline.
- Initialize `theme` and `difficulty` state from `localStorage` (with safe fallbacks: `"classic"` and `"off"`).
- Add `useEffect`s to write `catChess.theme` and `catChess.difficulty` to `localStorage` whenever they change.

**src/styles.css**
- Add `@keyframes cat-idle` — a very gentle 3s loop: ~1px vertical bob + ~1° rotation, easing in/out. Applied via `.cat-idle` to every piece image; paused on the actively-moving / captured piece so it doesn't fight the pop.
- Tune existing `cat-pop`: slightly larger overshoot (scale 1.0 → 1.18 → 0.96 → 1.0) with a soft squash on Y to feel bouncy/chibi.
- Tune `cat-capture`: quick puff — scale up to 1.3, rotate ~15°, fade with a slight blur, ~350ms.
- Respect `prefers-reduced-motion`: disable idle + reduce pop to a simple fade.

**Verification**
- Browser-check via Playwright: load `/`, toggle theme, open dev tools to confirm board + (forced) promotion picker swap art live; reload page and confirm theme + difficulty persist.

## Out of scope
- Game logic, AI behavior, or new piece artwork.
