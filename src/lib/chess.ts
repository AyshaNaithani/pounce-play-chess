// Cat Chess engine — standard chess rules (no castling/en-passant; promotion = queen).
export type Color = "w" | "b";
export type PieceType = "k" | "q" | "r" | "b" | "n" | "p";
export interface Piece {
  type: PieceType;
  color: Color;
}
export type Board = (Piece | null)[][]; // [row 0=top=black back rank][col 0=a-file]
export interface Move {
  from: [number, number];
  to: [number, number];
  piece: Piece;
  captured: Piece | null;
  promoted?: PieceType;
}
export interface GameState {
  board: Board;
  turn: Color;
  history: Move[];
  captured: Piece[]; // all captured pieces
  status: "playing" | "check" | "checkmate" | "stalemate";
  winner: Color | null;
}

export function initialBoard(): Board {
  const empty: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c++) {
    empty[0][c] = { type: back[c], color: "b" };
    empty[1][c] = { type: "p", color: "b" };
    empty[6][c] = { type: "p", color: "w" };
    empty[7][c] = { type: back[c], color: "w" };
  }
  return empty;
}

export function newGame(): GameState {
  return {
    board: initialBoard(),
    turn: "w",
    history: [],
    captured: [],
    status: "playing",
    winner: null,
  };
}

const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function rayMoves(
  board: Board,
  r: number,
  c: number,
  color: Color,
  dirs: [number, number][],
): [number, number][] {
  const out: [number, number][] = [];
  for (const [dr, dc] of dirs) {
    let nr = r + dr,
      nc = c + dc;
    while (inBounds(nr, nc)) {
      const tgt = board[nr][nc];
      if (!tgt) {
        out.push([nr, nc]);
      } else {
        if (tgt.color !== color) out.push([nr, nc]);
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return out;
}

const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN_DIRS: [number, number][] = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_DELTAS: [number, number][] = [
  [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
];
const KING_DELTAS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Pseudo-legal moves (does not consider king-in-check). */
export function pseudoMoves(board: Board, r: number, c: number): [number, number][] {
  const p = board[r][c];
  if (!p) return [];
  switch (p.type) {
    case "r":
      return rayMoves(board, r, c, p.color, ROOK_DIRS);
    case "b":
      return rayMoves(board, r, c, p.color, BISHOP_DIRS);
    case "q":
      return rayMoves(board, r, c, p.color, QUEEN_DIRS);
    case "n": {
      const out: [number, number][] = [];
      for (const [dr, dc] of KNIGHT_DELTAS) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const tgt = board[nr][nc];
        if (!tgt || tgt.color !== p.color) out.push([nr, nc]);
      }
      return out;
    }
    case "k": {
      const out: [number, number][] = [];
      for (const [dr, dc] of KING_DELTAS) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const tgt = board[nr][nc];
        if (!tgt || tgt.color !== p.color) out.push([nr, nc]);
      }
      return out;
    }
    case "p": {
      const out: [number, number][] = [];
      const dir = p.color === "w" ? -1 : 1;
      const startRow = p.color === "w" ? 6 : 1;
      const one = r + dir;
      if (inBounds(one, c) && !board[one][c]) {
        out.push([one, c]);
        const two = r + 2 * dir;
        if (r === startRow && !board[two][c]) out.push([two, c]);
      }
      for (const dc of [-1, 1]) {
        const nr = one, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const tgt = board[nr][nc];
        if (tgt && tgt.color !== p.color) out.push([nr, nc]);
      }
      return out;
    }
  }
}

function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) return [r, c];
    }
  return null;
}

export function isSquareAttacked(board: Board, r: number, c: number, by: Color): boolean {
  for (let sr = 0; sr < 8; sr++)
    for (let sc = 0; sc < 8; sc++) {
      const p = board[sr][sc];
      if (!p || p.color !== by) continue;
      // For pawn attacks, pseudoMoves includes forward moves we shouldn't count, but capture squares ARE included for occupied targets only.
      // We need attack squares regardless of occupancy — handle pawns specially.
      if (p.type === "p") {
        const dir = p.color === "w" ? -1 : 1;
        if (sr + dir === r && (sc - 1 === c || sc + 1 === c)) return true;
        continue;
      }
      for (const [tr, tc] of pseudoMoves(board, sr, sc)) {
        if (tr === r && tc === c) return true;
      }
    }
  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color);
  if (!k) return false;
  return isSquareAttacked(board, k[0], k[1], color === "w" ? "b" : "w");
}

/** Legal moves (filters out moves that leave own king in check). */
export function legalMoves(state: GameState, r: number, c: number): [number, number][] {
  const p = state.board[r][c];
  if (!p || p.color !== state.turn) return [];
  const result: [number, number][] = [];
  for (const [tr, tc] of pseudoMoves(state.board, r, c)) {
    const sim = cloneBoard(state.board);
    sim[tr][tc] = sim[r][c];
    sim[r][c] = null;
    // auto-promote for legality test
    if (p.type === "p" && (tr === 0 || tr === 7)) sim[tr][tc] = { type: "q", color: p.color };
    if (!isInCheck(sim, p.color)) result.push([tr, tc]);
  }
  return result;
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice());
}

export function applyMove(state: GameState, from: [number, number], to: [number, number]): GameState {
  const board = cloneBoard(state.board);
  const piece = board[from[0]][from[1]]!;
  const captured = board[to[0]][to[1]];
  board[to[0]][to[1]] = piece;
  board[from[0]][from[1]] = null;
  let promoted: PieceType | undefined;
  if (piece.type === "p" && (to[0] === 0 || to[0] === 7)) {
    board[to[0]][to[1]] = { type: "q", color: piece.color };
    promoted = "q";
  }
  const move: Move = { from, to, piece, captured, promoted };
  const nextTurn: Color = state.turn === "w" ? "b" : "w";
  const next: GameState = {
    board,
    turn: nextTurn,
    history: [...state.history, move],
    captured: captured ? [...state.captured, captured] : state.captured,
    status: "playing",
    winner: null,
  };
  // status
  const inCheck = isInCheck(board, nextTurn);
  const hasLegal = anyLegalMove(next);
  if (!hasLegal) {
    if (inCheck) {
      next.status = "checkmate";
      next.winner = state.turn;
    } else {
      next.status = "stalemate";
    }
  } else if (inCheck) {
    next.status = "check";
  }
  return next;
}

export function anyLegalMove(state: GameState): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      if (legalMoves(state, r, c).length > 0) return true;
    }
  return false;
}

export function undoMove(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const history = state.history.slice(0, -1);
  // rebuild from scratch (simple + safe)
  let s = newGame();
  for (const m of history) {
    s = applyMove(s, m.from, m.to);
  }
  return s;
}

export function squareName(r: number, c: number): string {
  return `${"abcdefgh"[c]}${8 - r}`;
}

export function moveToSAN(m: Move): string {
  const pieceLetter = m.piece.type === "p" ? "" : m.piece.type.toUpperCase();
  const capture = m.captured ? "x" : "";
  const from = m.piece.type === "p" && m.captured ? "abcdefgh"[m.from[1]] : "";
  return `${pieceLetter}${from}${capture}${squareName(m.to[0], m.to[1])}${m.promoted ? "=Q" : ""}`;
}