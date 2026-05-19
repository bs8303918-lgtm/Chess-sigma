"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import type { GachaCard } from "@/types/game";

type CardOpeningProps = {
  card: GachaCard | null;
  onClose: () => void;
};

const rarityColor: Record<GachaCard["rarity"], string> = {
  Common: "from-zinc-500 to-zinc-700",
  Rare: "from-sky-500 to-indigo-700",
  Epic: "from-fuchsia-500 to-purple-700",
  Legendary: "from-amber-300 to-orange-600",
};

export const CardOpening = ({ card, onClose }: CardOpeningProps) => {
  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <motion.div
            initial={{ scale: 0.2, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
            className={`relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br ${rarityColor[card.rarity]} p-1 shadow-[0_0_40px_rgba(255,255,255,0.35)]`}
          >
            <div className="relative rounded-[22px] bg-zinc-950 p-4 text-white">
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full bg-white/10 p-2 transition hover:bg-white/20"
              >
                <X size={16} />
              </button>

              <motion.div
                animate={{
                  boxShadow: [
                    "0px 0px 0px rgba(255,255,255,0.1)",
                    "0px 0px 32px rgba(255,255,255,0.35)",
                    "0px 0px 0px rgba(255,255,255,0.1)",
                  ],
                }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                className="overflow-hidden rounded-2xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image_url} alt={card.name} className="h-72 w-full object-cover" />
              </motion.div>

              <div className="mt-4 space-y-2 text-center">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  <Sparkles size={14} />
                  {card.rarity}
                </p>
                <h3 className="text-2xl font-bold">{card.name}</h3>
                <p className="text-sm text-zinc-300">Мемный дроп залетел прямо в коллекцию.</p>
                <button
                  onClick={onClose}
                  className="mt-2 w-full rounded-xl bg-emerald-500 py-2 font-semibold text-black hover:bg-emerald-400"
                >
                  Save to collection
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
