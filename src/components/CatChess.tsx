import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyMove,
  legalMoves,
  moveToSAN,
  newGame,
  squareName,
  undoMove,
  type GameState,
  type Piece,
  type PieceType,
  type Color,
} from "@/lib/chess";
import { PIECE_IMG, PIECE_NAME } from "@/lib/pieceImages";
import { chooseAIMove, type Difficulty } from "@/lib/ai";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

type CatTheme = "classic" | "swapped";
type GameMode = "friend" | "computer";

const THEME_KEY = "catChess.theme";
const DIFFICULTY_KEY = "catChess.difficulty";
const MODE_KEY = "catChess.mode";
const PLAYER_COLOR_KEY = "catChess.playerColor";

function loadTheme(): CatTheme {
  if (typeof window === "undefined") return "classic";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "swapped" || v === "classic" ? v : "classic";
}
function loadDifficulty(): Difficulty {
  if (typeof window === "undefined") return "off";
  const v = window.localStorage.getItem(DIFFICULTY_KEY);
  return v === "off" || v === "easy" || v === "medium" || v === "hard" ? v : "off";
}
function loadMode(): GameMode {
  if (typeof window === "undefined") return "friend";
  const v = window.localStorage.getItem(MODE_KEY);
  return v === "computer" || v === "friend" ? v : "friend";
}
function loadPlayerColor(): Color {
  if (typeof window === "undefined") return "w";
  const v = window.localStorage.getItem(PLAYER_COLOR_KEY);
  return v === "b" ? "b" : "w";
}

/**
 * Resolve which figurine artwork to display for a piece. The chess color
 * (turn order) is unchanged — only the artwork swaps.
 *  - classic: white side → cream art, black side → black art
 *  - swapped: white side → black art, black side → cream art
 */
function pieceArt(theme: CatTheme, color: Color, type: PieceType): string {
  const artColor: Color = theme === "classic" ? color : color === "w" ? "b" : "w";
  return PIECE_IMG[artColor][type];
}

function playBeep(type: "move" | "capture" | "meow") {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    if (type === "move") {
      o.frequency.value = 660;
      o.type = "triangle";
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.start();
      o.stop(ctx.currentTime + 0.13);
    } else if (type === "capture") {
      o.frequency.setValueAtTime(420, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);
      o.type = "sawtooth";
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      o.start();
      o.stop(ctx.currentTime + 0.23);
    } else {
      o.type = "sine";
      o.frequency.setValueAtTime(700, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(450, ctx.currentTime + 0.18);
      o.frequency.linearRampToValueAtTime(620, ctx.currentTime + 0.35);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.start();
      o.stop(ctx.currentTime + 0.42);
    }
  } catch {
    /* ignore audio errors */
  }
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface CaptureFx {
  id: number;
  row: number;
  col: number;
  piece: Piece;
}

export function CatChess() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [theme, setTheme] = useState<CatTheme>(loadTheme);
  const [mode, setMode] = useState<GameMode>(loadMode);
  const [playerColor, setPlayerColor] = useState<Color>(loadPlayerColor);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const d = loadDifficulty();
    return d === "off" ? "easy" : d;
  });
  const effectiveDifficulty: Difficulty = mode === "friend" ? "off" : difficulty;
  const [aiThinking, setAiThinking] = useState(false);
  // In computer mode, AI plays the opposite color of the player.
  const aiColor: Color = playerColor === "w" ? "b" : "w";
  const [pendingPromo, setPendingPromo] = useState<{
    from: [number, number];
    to: [number, number];
    color: Color;
  } | null>(null);
  const [captureFx, setCaptureFx] = useState<CaptureFx[]>([]);
  const fxIdRef = useRef(0);
  const startedRef = useRef(false);

  const targets = useMemo(() => {
    if (!selected) return [] as [number, number][];
    return legalMoves(state, selected[0], selected[1]);
  }, [selected, state]);

  const lastMove = state.history[state.history.length - 1] ?? null;

  // Persist preferences.
  useEffect(() => {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => {
    try { window.localStorage.setItem(DIFFICULTY_KEY, difficulty); } catch { /* ignore */ }
  }, [difficulty]);
  useEffect(() => {
    try { window.localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);
  useEffect(() => {
    try { window.localStorage.setItem(PLAYER_COLOR_KEY, playerColor); } catch { /* ignore */ }
  }, [playerColor]);

  // AI move trigger
  useEffect(() => {
    if (effectiveDifficulty === "off") return;
    if (state.turn !== aiColor) return;
    if (state.status === "checkmate" || state.status === "stalemate") return;
    if (pendingPromo) return;
    setAiThinking(true);
    // Defer so UI can paint the user's move first.
    const handle = window.setTimeout(() => {
      const choice = chooseAIMove(state, effectiveDifficulty);
      setAiThinking(false);
      if (!choice) return;
      commitMove(choice.from, choice.to, choice.promotion);
    }, 350);
    return () => {
      window.clearTimeout(handle);
      setAiThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, effectiveDifficulty]);

  useEffect(() => {
    if (state.status === "checkmate" || state.status === "stalemate") return;
    if (!startedRef.current) return;
    const id = window.setInterval(() => {
      if (state.turn === "w") setWhiteTime((t) => Math.max(0, t - 1));
      else setBlackTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.turn, state.status]);

  function commitMove(
    from: [number, number],
    to: [number, number],
    promotion: PieceType = "q",
  ) {
    const captured = state.board[to[0]][to[1]];
    const next = applyMove(state, from, to, promotion);
    startedRef.current = true;
    if (captured) {
      const id = ++fxIdRef.current;
      const fx: CaptureFx = { id, row: to[0], col: to[1], piece: captured };
      setCaptureFx((arr) => [...arr, fx]);
      window.setTimeout(() => {
        setCaptureFx((arr) => arr.filter((f) => f.id !== id));
      }, 500);
    }
    setState(next);
    setSelected(null);
    if (soundOn) playBeep(captured ? "capture" : "move");
    if (soundOn && (next.status === "check" || next.status === "checkmate")) {
      setTimeout(() => playBeep("meow"), 150);
    }
  }

  function handleSquareClick(r: number, c: number) {
    if (state.status === "checkmate" || state.status === "stalemate") return;
    if (pendingPromo) return;
    if (effectiveDifficulty !== "off" && state.turn === aiColor) return;
    const piece = state.board[r][c];
    if (selected) {
      if (selected[0] === r && selected[1] === c) {
        setSelected(null);
        return;
      }
      const isTarget = targets.some(([tr, tc]) => tr === r && tc === c);
      if (isTarget) {
        const moving = state.board[selected[0]][selected[1]]!;
        const isPromotion = moving.type === "p" && (r === 0 || r === 7);
        if (isPromotion) {
          setPendingPromo({ from: selected, to: [r, c], color: moving.color });
          return;
        }
        commitMove(selected, [r, c]);
        return;
      }
      if (piece && piece.color === state.turn) {
        setSelected([r, c]);
        return;
      }
      setSelected(null);
      return;
    }
    if (piece && piece.color === state.turn) setSelected([r, c]);
  }

  function restart() {
    setState(newGame());
    setSelected(null);
    setWhiteTime(600);
    setBlackTime(600);
    setPendingPromo(null);
    setCaptureFx([]);
    startedRef.current = false;
  }

  function undo() {
    setSelected(null);
    setPendingPromo(null);
    setCaptureFx([]);
    setState((s) => {
      // In computer mode, undo the AI's reply too so the human resumes their turn.
      if (effectiveDifficulty !== "off" && s.turn === playerColor && s.history.length >= 2) {
        return undoMove(undoMove(s));
      }
      return undoMove(s);
    });
  }

  const capturedByWhite = state.captured.filter((p) => p.color === "b");
  const capturedByBlack = state.captured.filter((p) => p.color === "w");

  const statusText =
    state.status === "checkmate"
      ? `Checkmate — ${state.winner === "w" ? "White" : "Black"} cats win! 🎉`
      : state.status === "stalemate"
      ? "Stalemate — it's a draw 🐾"
      : state.status === "check"
      ? `${state.turn === "w" ? "White" : "Black"} is in check!`
      : `${state.turn === "w" ? "White" : "Black"} to move`;

  return (
    <div className="min-h-screen bg-cream text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:py-10">
        <div className="flex-1">
          <header className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-paw lg:text-4xl">
                🐾 Cat Chess
              </h1>
              <p className="text-sm text-muted-foreground">
                Standard chess. Adorable cats. Click a piece, then click where to move.
              </p>
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </header>

          <div className="rounded-2xl bg-board-frame p-3 shadow-paw ring-1 ring-board-frame/60">
            <div className="grid grid-cols-[1.25rem_repeat(8,1fr)] grid-rows-[repeat(8,1fr)_1.25rem] gap-0">
              {Array.from({ length: 8 }).map((_, r) => (
                <FragmentRow
                  key={r}
                  row={r}
                  state={state}
                  selected={selected}
                  targets={targets}
                  onClick={handleSquareClick}
                  theme={theme}
                  lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
                  moveCount={state.history.length}
                  captureFx={captureFx}
                />
              ))}
              <div />
              {FILES.map((f) => (
                <div
                  key={f}
                  className="flex items-center justify-center text-[0.65rem] font-semibold text-board-label"
                >
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-card px-4 py-3 text-center text-sm font-semibold shadow-sm ring-1 ring-border">
            {aiThinking ? "🐈 Cat AI is thinking…" : statusText}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <ModeSelect value={mode} onChange={setMode} />
          {mode === "computer" && (
            <>
              <SideSelect
                value={playerColor}
                onChange={(c) => {
                  setPlayerColor(c);
                  // Restart so the new side assignment starts fresh.
                  setState(newGame());
                  setSelected(null);
                  setWhiteTime(600);
                  setBlackTime(600);
                  setPendingPromo(null);
                  setCaptureFx([]);
                  startedRef.current = false;
                }}
              />
              <DifficultySelect value={difficulty} onChange={setDifficulty} />
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TimerCard label="White" time={whiteTime} active={state.turn === "w"} />
            <TimerCard label="Black" time={blackTime} active={state.turn === "b"} dark />
          </div>

          <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Captured
            </div>
            <CapturedRow label="By White" pieces={capturedByWhite} theme={theme} />
            <CapturedRow label="By Black" pieces={capturedByBlack} theme={theme} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={state.history.length === 0}
              className="flex-1 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground shadow-sm ring-1 ring-border transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶ Undo
            </button>
            <button
              onClick={restart}
              className="flex-1 rounded-xl bg-paw px-3 py-2 text-sm font-semibold text-paw-foreground shadow-sm transition hover:bg-paw/90"
            >
              ⟳ Restart
            </button>
            <button
              onClick={() => {
                setSoundOn((s) => !s);
                if (!soundOn) playBeep("meow");
              }}
              className="rounded-xl bg-card px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-border transition hover:bg-accent"
              aria-label="Toggle sound"
              title="Toggle sound"
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
          </div>

          <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Move history
            </div>
            <div className="max-h-64 overflow-auto text-sm">
              {state.history.length === 0 ? (
                <div className="text-muted-foreground">No moves yet.</div>
              ) : (
                <ol className="grid grid-cols-[2rem_1fr_1fr] gap-x-2 gap-y-1 font-mono">
                  {Array.from({ length: Math.ceil(state.history.length / 2) }).map((_, i) => {
                    const w = state.history[i * 2];
                    const b = state.history[i * 2 + 1];
                    return (
                      <div key={i} className="contents">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{w ? moveToSAN(w) : ""}</span>
                        <span>{b ? moveToSAN(b) : ""}</span>
                      </div>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>

      {pendingPromo && (
        <PromotionPicker
          color={pendingPromo.color}
          theme={theme}
          onChoose={(type) => {
            const { from, to } = pendingPromo;
            setPendingPromo(null);
            commitMove(from, to, type);
          }}
          onCancel={() => setPendingPromo(null)}
        />
      )}
    </div>
  );
}

function FragmentRow({
  row,
  state,
  selected,
  targets,
  onClick,
  theme,
  lastMove,
  moveCount,
  captureFx,
}: {
  row: number;
  state: GameState;
  selected: [number, number] | null;
  targets: [number, number][];
  onClick: (r: number, c: number) => void;
  theme: CatTheme;
  lastMove: { from: [number, number]; to: [number, number] } | null;
  moveCount: number;
  captureFx: CaptureFx[];
}) {
  return (
    <>
      <div className="flex items-center justify-center text-[0.65rem] font-semibold text-board-label">
        {8 - row}
      </div>
      {Array.from({ length: 8 }).map((_, col) => {
        const isLight = (row + col) % 2 === 0;
        const piece = state.board[row][col];
        const isSelected = !!selected && selected[0] === row && selected[1] === col;
        const isTarget = targets.some(([r, c]) => r === row && c === col);
        const isCapture = isTarget && !!piece;
        const isLastFrom = !!lastMove && lastMove.from[0] === row && lastMove.from[1] === col;
        const isLastTo = !!lastMove && lastMove.to[0] === row && lastMove.to[1] === col;
        const fx = captureFx.find((f) => f.row === row && f.col === col);
        return (
          <button
            key={col}
            onClick={() => onClick(row, col)}
            aria-label={squareName(row, col)}
            className={[
              "relative aspect-square w-full transition-colors",
              isLight ? "bg-board-light" : "bg-board-dark",
              isSelected ? "ring-4 ring-inset ring-paw/80" : "",
            ].join(" ")}
          >
            {(isLastFrom || isLastTo) && (
              <span className="pointer-events-none absolute inset-0 bg-yellow-300/45 mix-blend-multiply" />
            )}
            {(isLastFrom || isLastTo) && (
              <span
                key={`trail-${moveCount}-${isLastTo ? "t" : "f"}`}
                className="cat-trail pointer-events-none absolute inset-0 bg-paw/25"
              />
            )}
            {piece && (
              <img
                key={`p-${moveCount}-${isLastTo ? "to" : "x"}`}
                src={pieceArt(theme, piece.color, piece.type)}
                alt={`${piece.color === "w" ? "White" : "Black"} ${PIECE_NAME[piece.type]}`}
                draggable={false}
                className={[
                  "pointer-events-none absolute inset-0 h-full w-full select-none object-contain p-[6%] drop-shadow-sm",
                  isLastTo ? "cat-pop" : "",
                ].join(" ")}
              />
            )}
            {fx && (
              <img
                key={`fx-${fx.id}`}
                src={pieceArt(theme, fx.piece.color, fx.piece.type)}
                alt=""
                className="cat-capture-fx pointer-events-none absolute inset-0 h-full w-full select-none object-contain p-[6%]"
              />
            )}
            {isTarget && !isCapture && (
              <span className="pointer-events-none absolute inset-0 m-auto h-3 w-3 rounded-full bg-paw/55" />
            )}
            {isCapture && (
              <span className="pointer-events-none absolute inset-1 rounded-full ring-4 ring-inset ring-destructive/70" />
            )}
          </button>
        );
      })}
    </>
  );
}

function TimerCard({
  label,
  time,
  active,
  dark,
}: {
  label: string;
  time: number;
  active: boolean;
  dark?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl p-3 shadow-sm ring-1 transition",
        dark ? "bg-zinc-900 text-zinc-50 ring-zinc-800" : "bg-white text-zinc-900 ring-border",
        active ? "ring-paw/80 ring-2 shadow-paw" : "",
      ].join(" ")}
    >
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="font-display text-2xl font-bold tabular-nums">{fmtTime(time)}</div>
    </div>
  );
}

function CapturedRow({
  label,
  pieces,
  theme,
}: {
  label: string;
  pieces: { type: PieceType; color: Color }[];
  theme: CatTheme;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex min-h-8 flex-wrap gap-1">
        {pieces.length === 0 && <span className="text-xs text-muted-foreground/60">—</span>}
        {pieces.map((p, i) => (
          <img
            key={i}
            src={pieceArt(theme, p.color, p.type)}
            alt=""
            className="h-7 w-7 object-contain"
          />
        ))}
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: CatTheme;
  setTheme: (t: CatTheme) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-border">
      <button
        onClick={() => setTheme("classic")}
        className={[
          "rounded-full px-3 py-1 text-xs font-semibold transition",
          theme === "classic"
            ? "bg-paw text-paw-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
        title="Cream cats for White, black cats for Black"
      >
        🐱 Cream
      </button>
      <button
        onClick={() => setTheme("swapped")}
        className={[
          "rounded-full px-3 py-1 text-xs font-semibold transition",
          theme === "swapped"
            ? "bg-paw text-paw-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
        title="Black cats for White, cream cats for Black"
      >
        🐈‍⬛ Black
      </button>
    </div>
  );
}

function PromotionPicker({
  color,
  theme,
  onChoose,
  onCancel,
}: {
  color: Color;
  theme: CatTheme;
  onChoose: (type: PieceType) => void;
  onCancel: () => void;
}) {
  const options: PieceType[] = ["q", "r", "b", "n"];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-border animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-center">
          <div className="font-display text-lg font-bold text-paw">Promote your kitten! 👑</div>
          <div className="text-xs text-muted-foreground">Pick which cat to crown.</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {options.map((t) => (
            <button
              key={t}
              onClick={() => onChoose(t)}
              className="group flex w-20 flex-col items-center gap-1 rounded-xl bg-board-light/60 p-2 ring-1 ring-border transition hover:bg-paw/15 hover:ring-paw/60"
            >
              <img
                src={pieceArt(theme, color, t)}
                alt={PIECE_NAME[t]}
                className="h-16 w-16 object-contain transition-transform group-hover:scale-110"
                draggable={false}
              />
              <span className="text-[0.7rem] font-semibold">{PIECE_NAME[t]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DifficultySelect({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  const opts: { id: Difficulty; label: string; hint: string }[] = [
    { id: "easy", label: "Kitten", hint: "Random" },
    { id: "medium", label: "Cat", hint: "Greedy" },
    { id: "hard", label: "Tiger", hint: "Depth 3" },
  ];
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Difficulty
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              title={o.hint}
              className={[
                "flex flex-col items-center rounded-lg px-1 py-2 text-[0.7rem] font-semibold transition",
                active
                  ? "bg-paw text-paw-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              ].join(" ")}
            >
              <span>{o.label}</span>
              <span className={["text-[0.6rem] font-normal", active ? "opacity-90" : "opacity-60"].join(" ")}>
                {o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SideSelect({
  value,
  onChange,
}: {
  value: Color;
  onChange: (c: Color) => void;
}) {
  const opts: { id: Color; label: string; hint: string }[] = [
    { id: "w", label: "♙ Play as White", hint: "You move first" },
    { id: "b", label: "♟ Play as Black", hint: "AI moves first" },
  ];
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your Side
      </div>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              title={o.hint}
              className={[
                "flex flex-col items-center rounded-lg px-2 py-2 text-xs font-semibold transition",
                active
                  ? "bg-paw text-paw-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              ].join(" ")}
            >
              <span>{o.label}</span>
              <span className={["mt-0.5 text-[0.6rem] font-normal", active ? "opacity-90" : "opacity-60"].join(" ")}>
                {o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModeSelect({
  value,
  onChange,
}: {
  value: GameMode;
  onChange: (m: GameMode) => void;
}) {
  const opts: { id: GameMode; label: string; hint: string }[] = [
    { id: "friend", label: "👥 Play a Friend", hint: "Two players, same device" },
    { id: "computer", label: "🤖 Play vs Computer", hint: "AI opponent" },
  ];
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Game Mode
      </div>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              title={o.hint}
              className={[
                "flex flex-col items-center rounded-lg px-2 py-3 text-xs font-semibold transition",
                active
                  ? "bg-paw text-paw-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              ].join(" ")}
            >
              <span>{o.label}</span>
              <span className={["mt-0.5 text-[0.6rem] font-normal", active ? "opacity-90" : "opacity-60"].join(" ")}>
                {o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}