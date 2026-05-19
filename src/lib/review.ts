import { Chess } from "chess.js";
import type { GameReviewData, GameReviewStats, ReviewMove } from "@/types/game";

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };

const sanitizePgn = (pgn: string) =>
  pgn
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\r/g, " ")
    .trim();

export const buildReviewFromPgn = (pgn: string): GameReviewData => {
  const game = new Chess();
 const sanitized = sanitizePgn(pgn);
  
  try {
    game.loadPgn(sanitized);
  } catch (e) {
    throw new Error("Could not parse PGN");
  }

  const replay = new Chess();
  const startFen = replay.fen();
  const verbose = game.history({ verbose: true });
  const positions = [startFen];

  const moves: ReviewMove[] = verbose.map((move, index) => {
    replay.move(move);
    positions.push(replay.fen());
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      piece: move.piece,
      captured: move.captured,
      moveNumber: Math.floor(index / 2) + 1,
    };
  });
  if (!moves.length) {
    throw new Error("Parsed PGN contains no moves");
  }

  const userColor: "w" | "b" = "w";
  const userMoves = moves.filter((move) => move.color === userColor);
  const opponentMoves = moves.filter((move) => move.color !== userColor);

  const captures = userMoves.filter((move) => Boolean(move.captured)).length;
  const checks = userMoves.filter((move) => move.san.includes("+") || move.san.includes("#")).length;
  const castles = userMoves.filter((move) => move.san === "O-O" || move.san === "O-O-O").length;
  const promotions = userMoves.filter((move) => move.san.includes("=")).length;
  const bestMoves = userMoves.filter((move) => move.captured && PIECE_VALUE[move.captured] > PIECE_VALUE[move.piece]).length + checks;
  const brilliant = userMoves.filter((move) => move.san.includes("#") || move.san.includes("=")).length;
  const great = userMoves.filter((move) => move.san.includes("+")).length + castles;
  const mistakes = Math.max(0, Math.round(userMoves.length * 0.12) - Math.round(bestMoves / 3));
  const misses = Math.max(0, Math.round(userMoves.length * 0.09) - Math.round(great / 4));
  const blunders = Math.max(0, Math.round(userMoves.length * 0.06) - Math.round(bestMoves / 6));
  const userAccuracy = Math.max(55, Math.min(98, 95 - mistakes * 3 - blunders * 5));
  const opponentAccuracy = Math.max(55, Math.min(98, 94 - Math.round(opponentMoves.length * 0.08)));
  const stats: GameReviewStats = {
    totalMoves: moves.length,
    captures,
    checks,
    castles,
    promotions,
    brilliant,
    great,
    bestMoves,
    mistakes,
    misses,
    blunders,
    userAccuracy,
    opponentAccuracy,
  };

  return {
    positions,
    moves,
    stats,
    resultText: "Imported game analyzed",
    userColor,
  };
};
