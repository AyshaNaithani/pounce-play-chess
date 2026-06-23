import { applyMove, legalMoves, type Color, type GameState, type PieceType } from "./chess";

export type Difficulty = "off" | "easy" | "medium" | "hard";

export interface AIMove {
  from: [number, number];
  to: [number, number];
  promotion: PieceType;
}

const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluate(state: GameState, perspective: Color): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      const v = VALUE[p.type];
      score += p.color === perspective ? v : -v;
    }
  }
  // tiny center bonus
  const centerSquares: [number, number][] = [[3, 3], [3, 4], [4, 3], [4, 4]];
  for (const [r, c] of centerSquares) {
    const p = state.board[r][c];
    if (!p) continue;
    score += (p.color === perspective ? 10 : -10);
  }
  return score;
}

function allLegalMoves(state: GameState): AIMove[] {
  const moves: AIMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      for (const [tr, tc] of legalMoves(state, r, c)) {
        moves.push({ from: [r, c], to: [tr, tc], promotion: "q" });
      }
    }
  }
  return moves;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  perspective: Color,
): number {
  if (state.status === "checkmate") {
    return state.turn === perspective ? -100000 - depth : 100000 + depth;
  }
  if (state.status === "stalemate") return 0;
  if (depth === 0) return evaluate(state, perspective);

  const maximizing = state.turn === perspective;
  const moves = allLegalMoves(state);
  if (moves.length === 0) return evaluate(state, perspective);
  moves.sort((a, b) => {
    const ca = state.board[a.to[0]][a.to[1]] ? VALUE[state.board[a.to[0]][a.to[1]]!.type] : 0;
    const cb = state.board[b.to[0]][b.to[1]] ? VALUE[state.board[b.to[0]][b.to[1]]!.type] : 0;
    return cb - ca;
  });

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const next = applyMove(state, m.from, m.to, m.promotion);
      const s = minimax(next, depth - 1, alpha, beta, perspective);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const next = applyMove(state, m.from, m.to, m.promotion);
      const s = minimax(next, depth - 1, alpha, beta, perspective);
      if (s < best) best = s;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

/** Choose an AI move for state.turn. Returns null if no legal move. */
export function chooseAIMove(state: GameState, difficulty: Difficulty): AIMove | null {
  const moves = allLegalMoves(state);
  if (moves.length === 0) return null;
  const perspective = state.turn;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === "medium") {
    // 1-ply greedy with material + small randomization
    let best = -Infinity;
    let pool: AIMove[] = [];
    for (const m of moves) {
      const next = applyMove(state, m.from, m.to, m.promotion);
      let s = evaluate(next, perspective);
      if (next.status === "checkmate" && next.winner === perspective) s += 99999;
      // tiny noise
      s += Math.random() * 5;
      if (s > best + 0.0001) {
        best = s;
        pool = [m];
      } else if (Math.abs(s - best) < 0.0001) {
        pool.push(m);
      }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // hard: minimax depth 3 with alpha-beta
  const depth = 3;
  let best = -Infinity;
  let bestMove: AIMove = moves[0];
  moves.sort((a, b) => {
    const ca = state.board[a.to[0]][a.to[1]] ? VALUE[state.board[a.to[0]][a.to[1]]!.type] : 0;
    const cb = state.board[b.to[0]][b.to[1]] ? VALUE[state.board[b.to[0]][b.to[1]]!.type] : 0;
    return cb - ca;
  });
  let alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const next = applyMove(state, m.from, m.to, m.promotion);
    const score = minimax(next, depth - 1, alpha, beta, perspective);
    if (score > best) {
      best = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
  }
  return bestMove;
}