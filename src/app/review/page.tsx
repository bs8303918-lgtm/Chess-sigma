"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Chessboard } from "react-chessboard";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Crown,
  Home,
  Lightbulb,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import type { GameReviewData, SigmaJudgeResult } from "@/types/game";

type StoredReview = {
  review: GameReviewData;
  judge: SigmaJudgeResult;
  savedAt: number;
};

const qualityForSan = (san: string) => {
  if (san.includes("??")) {
    return {
      label: "Blunder",
      icon: <CircleX size={16} className="text-rose-300" />,
      badge: "BL",
      overlayIcon: "/review-icons/blunder.png",
      arrowColor: "#ef4444",
      text: "Coach: this move drops material or position. Recheck tactics before committing.",
    };
  }
  if (san.includes("#") || san.includes("=")) {
    return {
      label: "Brilliant move",
      icon: <Crown size={16} className="text-cyan-300" />,
      badge: "BR",
      overlayIcon: "/review-icons/brilliant.png",
      arrowColor: "#22d3ee",
      text: "Coach: brilliant conversion. This is a 1000 IQ finish.",
    };
  }
  if (san.includes("+")) {
    return {
      label: "Great move",
      icon: <Sparkles size={16} className="text-sky-300" />,
      badge: "GR",
      overlayIcon: "/review-icons/great.png",
      arrowColor: "#38bdf8",
      text: "Coach: strong forcing move. You kept initiative.",
    };
  }
  if (san.includes("x")) {
    return {
      label: "Best move",
      icon: <Star size={16} className="text-lime-300" />,
      badge: "BM",
      overlayIcon: "/review-icons/best.png",
      arrowColor: "#84cc16",
      text: "Coach: clean material gain and stable position.",
    };
  }
  if (san.startsWith("N") || san.startsWith("B")) {
    return {
      label: "Inaccuracy",
      icon: <AlertCircle size={16} className="text-amber-300" />,
      badge: "?!",
      overlayIcon: "/review-icons/mistake.png",
      arrowColor: "#f59e0b",
      text: "Coach: playable, but there was a stronger idea.",
    };
  }
  return {
    label: "Normal move",
    icon: <Lightbulb size={16} className="text-zinc-300" />,
    badge: "OK",
    overlayIcon: "/review-icons/normal.png",
    arrowColor: "#64748b",
    text: "Coach: normal development move, no major risk.",
  };
};

export default function ReviewPage() {
  const router = useRouter();
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const [boardPx, setBoardPx] = useState(680);
  const [data] = useState<StoredReview | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("sigma-review");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredReview;
    } catch {
      return null;
    }
  });
  const [index, setIndex] = useState(0);

  const review = data?.review ?? null;
  const judge = data?.judge ?? null;
  const safeIndex = useMemo(() => {
    if (!review) return 0;
    return Math.max(0, Math.min(index, review.positions.length - 1));
  }, [index, review]);

  useEffect(() => {
    if (!review) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setIndex((prev) => Math.max(0, prev - 1));
      if (event.key === "ArrowRight") setIndex((prev) => Math.min(review.positions.length - 1, prev + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review]);

  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const width = el.getBoundingClientRect().width;
      setBoardPx(Math.max(280, Math.min(860, Math.floor(width))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!review) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <p className="text-lg font-semibold">No review data found</p>
          <p className="mt-2 text-sm text-zinc-400">Finish a game first, then open analysis.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 hover:bg-zinc-700"
          >
            <Home size={14} />
            Back to game
          </button>
        </div>
      </main>
    );
  }

  const activeMove = safeIndex > 0 ? review.moves[safeIndex - 1] : null;
  const quality = activeMove ? qualityForSan(activeMove.san) : null;
  const arrows =
    activeMove && activeMove.from && activeMove.to && quality
      ? [{ startSquare: activeMove.from, endSquare: activeMove.to, color: quality.arrowColor }]
      : [];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 gap-4 bg-zinc-950 p-3 md:grid-cols-[minmax(520px,860px)_400px] md:p-4">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Game Review</h1>
            <p className="text-sm text-zinc-400">{review.resultText} · chess.com style</p>
          </div>
          <button onClick={() => router.push("/review/import")} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
            Back
          </button>
        </div>

        <div ref={boardWrapRef} className="w-full flex justify-center">
          <Chessboard
            options={{
            id: "full-review-board",
            position: review.positions[safeIndex],
            allowDragging: false,
            arrows,
            boardStyle: { width: boardPx, height: boardPx, maxWidth: "100%" },
            squareRenderer: ({ square, children }) => (
              <div className="relative h-full w-full">
                {children}
                {activeMove?.to === square && quality && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 p-0.5">
                    <Image src={quality.overlayIcon} alt={quality.label} width={24} height={24} />
                  </span>
                )}
              </div>
            ),
            darkSquareStyle: { backgroundColor: "#2f2f39" },
            lightSquareStyle: { backgroundColor: "#f0f0f3" },
          }}
          />
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Trophy size={16} />
            Sigma Judge Verdict
          </h3>
          <p className="text-sm font-semibold text-fuchsia-300">{judge?.title ?? "-"}</p>
          <p className="mt-1 text-sm text-zinc-300">{judge?.verdict ?? "-"}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">Coach Feedback</h3>
          {activeMove && quality ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-zinc-800/70 px-3 py-2">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  {quality.icon}
                  {quality.label}
                </p>
                <p className="text-xs text-zinc-400">{activeMove.san}</p>
              </div>
              <p className="text-sm text-zinc-300">{quality.text}</p>
              <p className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <ArrowRight size={14} />
                {activeMove.from} to {activeMove.to}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Use buttons or keyboard arrows to inspect moves.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-zinc-900 p-3">
            <p className="text-zinc-400">Your Accuracy</p>
            <p className="text-lg font-semibold">{review.stats.userAccuracy}%</p>
          </div>
          <div className="rounded-xl bg-zinc-900 p-3">
            <p className="text-zinc-400">Opponent Accuracy</p>
            <p className="text-lg font-semibold">{review.stats.opponentAccuracy}%</p>
          </div>
          <div className="rounded-xl bg-zinc-900 p-3"><p className="text-zinc-400">Brilliant</p><p className="text-lg font-semibold text-cyan-300">{review.stats.brilliant}</p></div>
          <div className="rounded-xl bg-zinc-900 p-3"><p className="text-zinc-400">Great</p><p className="text-lg font-semibold text-sky-300">{review.stats.great}</p></div>
          <div className="rounded-xl bg-zinc-900 p-3"><p className="text-zinc-400">Best</p><p className="text-lg font-semibold text-emerald-300">{review.stats.bestMoves}</p></div>
          <div className="rounded-xl bg-zinc-900 p-3"><p className="text-zinc-400">Mistakes</p><p className="text-lg font-semibold text-amber-300">{review.stats.mistakes}</p></div>
          <div className="rounded-xl bg-zinc-900 p-3"><p className="text-zinc-400">Misses</p><p className="text-lg font-semibold text-orange-300">{review.stats.misses}</p></div>
          <div className="rounded-xl bg-zinc-900 p-3"><p className="text-zinc-400">Blunders</p><p className="inline-flex items-center gap-1 text-lg font-semibold text-rose-300"><CircleX size={16} />{review.stats.blunders}</p></div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIndex((prev) => Math.max(0, prev - 1))} className="rounded-xl bg-zinc-800 px-3 py-2 hover:bg-zinc-700"><ChevronLeft size={16} /></button>
          <button onClick={() => setIndex((prev) => Math.min(review.positions.length - 1, prev + 1))} className="rounded-xl bg-zinc-800 px-3 py-2 hover:bg-zinc-700"><ChevronRight size={16} /></button>
          <p className="text-sm text-zinc-400">{safeIndex}/{review.positions.length - 1}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/30 p-2 text-sm">
          {review.moves.map((move, moveIndex) => {
            const q = qualityForSan(move.san);
            return (
              <button
                key={`${move.moveNumber}-${move.san}-${moveIndex}`}
                onClick={() => setIndex(moveIndex + 1)}
                className={`grid w-full grid-cols-[56px_18px_1fr_72px] items-center gap-2 rounded-lg px-2 py-1 text-left ${
                  safeIndex === moveIndex + 1 ? "bg-fuchsia-500/20 text-fuchsia-200" : "hover:bg-zinc-800"
                }`}
              >
                <span className="text-zinc-400">{move.moveNumber}{move.color === "w" ? "." : "..."}</span>
                <span className="text-xs text-zinc-400">{q.badge}</span>
                <span className="font-medium">{move.san}</span>
                <span className="text-right text-zinc-500">{move.from}-{move.to}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
