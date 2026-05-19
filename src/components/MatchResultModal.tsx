"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleWarning, Swords, Trophy, X } from "lucide-react";
import type { GameReviewData } from "@/types/game";

type MatchResultModalProps = {
  open: boolean;
  review: GameReviewData | null;
  judgeVerdict?: string;
  loadingJudge: boolean;
  onClose: () => void;
  onNewGame: () => void;
  onAnalyze: () => void;
};

export const MatchResultModal = ({
  open,
  review,
  judgeVerdict,
  loadingJudge,
  onClose,
  onNewGame,
  onAnalyze,
}: MatchResultModalProps) => {
  if (!review) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div className="inline-flex items-center gap-2">
                <Trophy className="text-amber-300" size={18} />
                <div>
                  <p className="text-xl font-bold">
                    {review.resultText.includes("won")
                      ? "You won"
                      : review.resultText.includes("lost")
                        ? "You lost"
                        : "Draw"}
                  </p>
                  <p className="text-xs text-zinc-400">{review.resultText}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-full bg-zinc-800 p-2 hover:bg-zinc-700">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <p className="text-sm text-zinc-300">
                Your stats: Brilliant {review.stats.brilliant}, Best {review.stats.bestMoves}, Great{" "}
                {review.stats.great}.
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="mb-1 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  <MessageCircleWarning size={14} />
                  AI Judge
                </p>
                <p className="text-sm text-zinc-200">
                  {judgeVerdict ?? (loadingJudge ? "Preparing Sigma verdict..." : "Judge text is not ready.")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Moves analyzed: {review.stats.totalMoves}</p>
              </div>

              <button
                onClick={onAnalyze}
                disabled={loadingJudge}
                className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {loadingJudge ? "Preparing review..." : "Review"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onNewGame}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 py-2 text-sm font-semibold hover:bg-zinc-700"
                >
                  <Swords size={14} />
                  Play again
                </button>
                <button onClick={onAnalyze} className="rounded-xl bg-zinc-800 py-2 text-sm font-semibold hover:bg-zinc-700">
                  Review
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
