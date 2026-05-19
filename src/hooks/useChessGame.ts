"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { fallbackJudge } from "@/lib/judge";
import { rollGachaCard } from "@/lib/cards";
import type {
  GameRecordPayload,
  GameReviewData,
  GameReviewStats,
  GachaCard,
  ReviewMove,
  SigmaJudgeResult,
} from "@/types/game";

type UseChessGameOptions = {
  onSaveGame?: (payload: GameRecordPayload, card?: GachaCard) => Promise<void>;
};

export type AiPreset = {
  id: string;
  name: string;
  depth: number;
  moveTime: number;
  skillLevel: number;
};

type JudgeState = {
  loading: boolean;
  result: SigmaJudgeResult | null;
};

type WorkerReply = { type: "bestmove"; move: string } | { type: "error"; message: string };

const AI_COLOR: Color = "b";
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const DEFAULT_AI_PRESET: AiPreset = {
  id: "meme-speedrun",
  name: "Meme Speedrun",
  depth: 7,
  moveTime: 350,
  skillLevel: 5,
};

export const useChessGame = ({ onSaveGame }: UseChessGameOptions = {}) => {
  const [game] = useState(() => new Chess());
  const workerRef = useRef<Worker | null>(null);

  const [fen, setFen] = useState(() => game.fen());
  const [status, setStatus] = useState("White to move");
  const [gameMode, setGameMode] = useState<"human" | "ai" | "online">("ai");
  const [aiPreset, setAiPreset] = useState<AiPreset>(DEFAULT_AI_PRESET);
  const [aiThinking, setAiThinking] = useState(false);
  const [legalMoves, setLegalMoves] = useState<Record<string, string[]>>({});
  const [lastPgn, setLastPgn] = useState("");
  const [judgeState, setJudgeState] = useState<JudgeState>({ loading: false, result: null });
  const [wonCard, setWonCard] = useState<GachaCard | null>(null);
  const [reviewData, setReviewData] = useState<GameReviewData | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [redoStack, setRedoStack] = useState<Array<{ from: string; to: string; promotion?: string }>>([]);
  const [moveHistorySan, setMoveHistorySan] = useState<string[]>([]);

  const buildReview = useCallback((): GameReviewData => {
    const startFen = new Chess().fen();
    const replay = new Chess();
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
    const userColor: "w" | "b" = gameMode === "ai" ? "w" : "w";
    const userMoves = moves.filter((move) => move.color === userColor);
    const opponentMoves = moves.filter((move) => move.color !== userColor);

    const captures = userMoves.filter((move) => Boolean(move.captured)).length;
    const checks = userMoves.filter((move) => move.san.includes("+") || move.san.includes("#")).length;
    const castles = userMoves.filter((move) => move.san === "O-O" || move.san === "O-O-O").length;
    const promotions = userMoves.filter((move) => move.san.includes("=")).length;
    const bestMoves = userMoves.filter((move) => {
      if (!move.captured) return false;
      return PIECE_VALUE[move.captured] > PIECE_VALUE[move.piece];
    }).length + checks;
    const brilliant = userMoves.filter((move) => move.san.includes("#") || move.san.includes("=")).length;
    const great = userMoves.filter((move) => move.san.includes("+")).length + castles;
    const mistakes = Math.max(0, Math.round(userMoves.length * 0.12) - Math.round(bestMoves / 3));
    const misses = Math.max(0, Math.round(userMoves.length * 0.09) - Math.round(great / 4));
    const blunders = Math.max(0, Math.round(userMoves.length * 0.06) - Math.round(bestMoves / 6));
    const userAccuracy = Math.max(55, Math.min(98, 95 - mistakes * 3 - blunders * 5));
    const opponentAccuracy = Math.max(
      55,
      Math.min(98, 94 - Math.round(opponentMoves.length * 0.08)),
    );

    const userWonByMate = game.isCheckmate() && game.turn() !== userColor;
    const userLostByMate = game.isCheckmate() && game.turn() === userColor;
    const resultText = userWonByMate
      ? "You won by checkmate"
      : userLostByMate
        ? "You lost by checkmate"
        : game.isDraw()
          ? "Draw by rule"
          : "Game finished";

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

    return { positions, moves, stats, resultText, userColor };
  }, [game, gameMode]);

  const updateStateFromGame = useCallback(() => {
    setFen(game.fen());
    setMoveHistorySan(game.history());
    if (game.isCheckmate()) {
      const winner = game.turn() === "w" ? "Black" : "White";
      setStatus(`Checkmate! ${winner} wins.`);
      return;
    }
    if (game.isDraw()) {
      setStatus("Draw game.");
      return;
    }
    setStatus(`${game.turn() === "w" ? "White" : "Black"} to move`);
  }, [game]);

  const getMoveOptions = useCallback(
    (square: Square) => {
      const moves = game.moves({
        square,
        verbose: true,
      });

      if (!moves.length) return false;

      const nextMoves: Record<string, string[]> = {};
      nextMoves[square] = [];
      moves.forEach((move) => nextMoves[square].push(move.to));
      setLegalMoves(nextMoves);
      return true;
    },
    [game],
  );

  const clearMoveOptions = useCallback(() => {
    setLegalMoves({});
  }, []);

  const triggerJudge = useCallback(async (pgn: string) => {
    setJudgeState({ loading: true, result: null });
    try {
      const response = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pgn }),
      });

      if (!response.ok) throw new Error("Judge request failed");
      const data = (await response.json()) as SigmaJudgeResult;
      setJudgeState({ loading: false, result: data });
      return data;
    } catch {
      const fallback = fallbackJudge(pgn);
      setJudgeState({ loading: false, result: fallback });
      return fallback;
    }
  }, []);

  const completeGame = useCallback(async () => {
    const review = buildReview();
    setReviewData(review);
    setIsResultOpen(true);

    const pgn = game.pgn();
    setLastPgn(pgn);
    const judge = await triggerJudge(pgn);

    const whiteWon = game.isCheckmate() && game.turn() === "b";
    const draw = game.isDraw();
    const winner = whiteWon ? "white" : draw ? "draw" : "black";
    const card = whiteWon ? rollGachaCard() : undefined;
    if (card) setWonCard(card);

    if (onSaveGame) {
      await onSaveGame({ pgn, result: winner, sigmaVerdict: judge, stats: review.stats }, card);
    }
  }, [buildReview, game, onSaveGame, triggerJudge]);

  const requestAiMove = useCallback(() => {
    if (game.isGameOver() || game.turn() !== AI_COLOR || gameMode !== "ai") return;
    if (!workerRef.current) return;

    setAiThinking(true);
    workerRef.current.postMessage({
      fen: game.fen(),
      depth: aiPreset.depth,
      moveTime: aiPreset.moveTime,
      skillLevel: aiPreset.skillLevel,
    });
  }, [aiPreset.depth, aiPreset.moveTime, aiPreset.skillLevel, game, gameMode]);

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      let move: ReturnType<Chess["move"]> | null = null;
      try {
        move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
      } catch {
        return false;
      }

      if (!move) return false;

      clearMoveOptions();
      setRedoStack([]);
      updateStateFromGame();

      if (game.isGameOver()) {
        void completeGame();
        return true;
      }

      requestAiMove();
      return true;
    },
    [clearMoveOptions, completeGame, game, requestAiMove, updateStateFromGame],
  );

  const resetGame = useCallback(() => {
    game.reset();
    setJudgeState({ loading: false, result: null });
    setWonCard(null);
    setLastPgn("");
    setReviewData(null);
    setIsResultOpen(false);
    setRedoStack([]);
    setMoveHistorySan([]);
    clearMoveOptions();
    updateStateFromGame();
  }, [clearMoveOptions, game, updateStateFromGame]);

  const undoMove = useCallback(() => {
    const last = game.undo();
    if (!last) return false;
    setRedoStack((prev) => [...prev, { from: last.from, to: last.to, promotion: last.promotion }]);
    setJudgeState({ loading: false, result: null });
    setReviewData(null);
    setIsResultOpen(false);
    setWonCard(null);
    updateStateFromGame();
    return true;
  }, [game, updateStateFromGame]);

  const redoMove = useCallback(() => {
    const stack = [...redoStack];
    const next = stack.pop();
    if (!next) return false;
    try {
      game.move({ from: next.from, to: next.to, promotion: next.promotion ?? "q" });
    } catch {
      return false;
    }
    setRedoStack(stack);
    updateStateFromGame();
    return true;
  }, [game, redoStack, updateStateFromGame]);

  const applyExternalMove = useCallback(
    (sourceSquare: string, targetSquare: string, promotion = "q") => {
      try {
        const move = game.move({ from: sourceSquare, to: targetSquare, promotion: promotion as PieceSymbol });
        if (!move) return false;
      } catch {
        return false;
      }
      setRedoStack([]);
      clearMoveOptions();
      updateStateFromGame();
      if (game.isGameOver()) {
        void completeGame();
      }
      return true;
    },
    [clearMoveOptions, completeGame, game, updateStateFromGame],
  );

  useEffect(() => {
    const worker = new Worker(new URL("../workers/stockfishWorker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = async (event: MessageEvent<WorkerReply>) => {
      const data = event.data;
      if (data.type === "error") {
        setAiThinking(false);
        return;
      }

      if (data.type === "bestmove") {
        const move = data.move;
        if (move && move !== "(none)") {
          try {
            const promotion = move.length > 4 ? (move[4] as PieceSymbol) : "q";
            game.move({
              from: move.slice(0, 2),
              to: move.slice(2, 4),
              promotion,
            });
          } catch {
            setAiThinking(false);
            return;
          }
          updateStateFromGame();
        }

        setAiThinking(false);
        if (game.isGameOver()) {
          await completeGame();
        }
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [completeGame, game, updateStateFromGame]);

  const modeLabel = useMemo(() => {
    if (gameMode === "ai") return "Player vs Stockfish";
    if (gameMode === "online") return "Online arena (beta room)";
    return "Local duel";
  }, [gameMode]);

  return {
    fen,
    status,
    legalMoves,
    aiThinking,
    gameMode,
    aiPreset,
    modeLabel,
    judgeState,
    reviewData,
    isResultOpen,
    wonCard,
    lastPgn,
    onDrop,
    resetGame,
    getMoveOptions,
    clearMoveOptions,
    setGameMode,
    setAiPreset,
    setWonCard,
    setIsResultOpen,
    undoMove,
    redoMove,
    canRedo: redoStack.length > 0,
    applyExternalMove,
    moveHistorySan,
  };
};
