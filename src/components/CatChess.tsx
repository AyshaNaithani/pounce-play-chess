import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyMove,
  legalMoves,
  moveToSAN,
  newGame,
  squareName,
  undoMove,
  type GameState,
} from "@/lib/chess";
import { PIECE_IMG, PIECE_NAME } from "@/lib/pieceImages";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

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
      // meow: pitch slide
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

export function CatChess() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const startedRef = useRef(false);

  const targets = useMemo(() => {
    if (!selected) return [] as [number, number][];
    return legalMoves(state, selected[0], selected[1]);
  }, [selected, state]);

  // timer
  useEffect(() => {
    if (state.status === "checkmate" || state.status === "stalemate") return;
    if (!startedRef.current) return;
    const id = window.setInterval(() => {
      if (state.turn === "w") setWhiteTime((t) => Math.max(0, t - 1));
      else setBlackTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.turn, state.status]);

  function handleSquareClick(r: number, c: number) {
    if (state.status === "checkmate" || state.status === "stalemate") return;
    const piece = state.board[r][c];
    if (selected) {
      if (selected[0] === r && selected[1] === c) {
        setSelected(null);
        return;
      }
      const isTarget = targets.some(([tr, tc]) => tr === r && tc === c);
      if (isTarget) {
        const captured = state.board[r][c];
        const next = applyMove(state, selected, [r, c]);
        startedRef.current = true;
        setState(next);
        setSelected(null);
        if (soundOn) playBeep(captured ? "capture" : "move");
        if (soundOn && (next.status === "check" || next.status === "checkmate")) {
          setTimeout(() => playBeep("meow"), 150);
        }
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
    startedRef.current = false;
  }

  function undo() {
    setState((s) => undoMove(s));
    setSelected(null);
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
        {/* Board */}
        <div className="flex-1">
          <header className="mb-4 flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-paw lg:text-4xl">
                🐾 Cat Chess
              </h1>
              <p className="text-sm text-muted-foreground">
                Standard chess. Adorable cats. Click a piece, then click where to move.
              </p>
            </div>
          </header>

          <div className="rounded-2xl bg-board-frame p-3 shadow-paw ring-1 ring-board-frame/60">
            <div className="grid grid-cols-[1.25rem_repeat(8,1fr)] grid-rows-[repeat(8,1fr)_1.25rem] gap-0">
              {/* board rows + rank labels */}
              {Array.from({ length: 8 }).map((_, r) => (
                <FragmentRow
                  key={r}
                  row={r}
                  state={state}
                  selected={selected}
                  targets={targets}
                  onClick={handleSquareClick}
                />
              ))}
              {/* file labels row */}
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
            {statusText}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <div className="grid grid-cols-2 gap-3">
            <TimerCard label="White" time={whiteTime} active={state.turn === "w"} />
            <TimerCard label="Black" time={blackTime} active={state.turn === "b"} dark />
          </div>

          <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Captured
            </div>
            <CapturedRow label="By White" pieces={capturedByWhite} />
            <CapturedRow label="By Black" pieces={capturedByBlack} />
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
    </div>
  );
}

function FragmentRow({
  row,
  state,
  selected,
  targets,
  onClick,
}: {
  row: number;
  state: GameState;
  selected: [number, number] | null;
  targets: [number, number][];
  onClick: (r: number, c: number) => void;
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
            {piece && (
              <img
                src={PIECE_IMG[piece.color][piece.type]}
                alt={`${piece.color === "w" ? "White" : "Black"} ${PIECE_NAME[piece.type]}`}
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain p-[6%] drop-shadow-sm"
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
}: {
  label: string;
  pieces: { type: import("@/lib/chess").PieceType; color: import("@/lib/chess").Color }[];
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex min-h-8 flex-wrap gap-1">
        {pieces.length === 0 && <span className="text-xs text-muted-foreground/60">—</span>}
        {pieces.map((p, i) => (
          <img
            key={i}
            src={PIECE_IMG[p.color][p.type]}
            alt=""
            className="h-7 w-7 object-contain"
          />
        ))}
      </div>
    </div>
  );
}