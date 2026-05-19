"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Crown, X } from "lucide-react";

type RankCardModalProps = {
  open: boolean;
  elo: number;
  title: string;
  description: string;
  onClose: () => void;
};

export const RankCardModal = ({ open, elo, title, description, onClose }: RankCardModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <motion.div
            initial={{ scale: 0.25, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 16 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-fuchsia-500/40 via-zinc-900 to-amber-500/30 p-1 shadow-[0_0_50px_rgba(168,85,247,0.35)]"
          >
            <div className="relative rounded-[22px] bg-zinc-950 p-5 text-white">
              <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/10 p-2 hover:bg-white/20">
                <X size={16} />
              </button>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-fuchsia-500/15 p-3">
                  <Crown className="text-amber-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Rank Evaluation</p>
                  <h3 className="text-2xl font-black leading-tight">{title}</h3>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-400">Estimated ELO</p>
                  <p className="text-3xl font-black text-emerald-300">{elo}</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-400">Status</p>
                  <p className="mt-1 text-sm font-semibold">Calibration completed</p>
                </div>
              </div>

              <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-200">
                {description}
              </p>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-black hover:bg-emerald-400"
              >
                Accept rank
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

