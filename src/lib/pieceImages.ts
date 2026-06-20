import wK from "@/assets/pieces/white_king.png";
import wQ from "@/assets/pieces/white_queen.png";
import wR from "@/assets/pieces/white_rook.png";
import wB from "@/assets/pieces/white_bishop.png";
import wN from "@/assets/pieces/white_knight.png";
import wP from "@/assets/pieces/white_pawn.png";
import bK from "@/assets/pieces/black_king.png";
import bQ from "@/assets/pieces/black_queen.png";
import bR from "@/assets/pieces/black_rook.png";
import bB from "@/assets/pieces/black_bishop.png";
import bN from "@/assets/pieces/black_knight.png";
import bP from "@/assets/pieces/black_pawn.png";
import type { Color, PieceType } from "./chess";

export const PIECE_IMG: Record<Color, Record<PieceType, string>> = {
  w: { k: wK, q: wQ, r: wR, b: wB, n: wN, p: wP },
  b: { k: bK, q: bQ, r: bR, b: bB, n: bN, p: bP },
};

export const PIECE_NAME: Record<PieceType, string> = {
  k: "King Cat",
  q: "Queen Cat",
  r: "Tower Cat",
  b: "Wizard Cat",
  n: "Warrior Cat",
  p: "Kitten",
};