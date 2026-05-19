"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Trophy } from "lucide-react";
import { evolveTitle } from "@/lib/rating";

type LocalGameHistoryEntry = {
  playedAt: number;
  result: "white" | "black" | "draw";
  pgn: string;
  auraDelta: number;
  title: string;
  accuracy?: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const [history] = useState<LocalGameHistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("sigma-game-history");
    return raw ? (JSON.parse(raw) as LocalGameHistoryEntry[]) : [];
  });

  const elo = useMemo(() => {
    let value = 1200;
    history.slice().reverse().forEach((entry) => {
      if (entry.result === "white") value += 12;
      else if (entry.result === "black") value -= 10;
      else value += 2;
    });
    return Math.max(100, value);
  }, [history]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-4">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Profile & Ranked History</h1>
            <p className="text-sm text-zinc-400">Calibration in first 5 games, then ranked progression.</p>
          </div>
          <button onClick={() => router.push("/")} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
            <Home size={14} className="mr-1 inline" />
            Home
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-zinc-900 p-3">
            <p className="text-zinc-400">Current ELO</p>
            <p className="text-2xl font-bold">{elo}</p>
          </div>
          <div className="rounded-xl bg-zinc-900 p-3">
            <p className="text-zinc-400">Games played</p>
            <p className="text-2xl font-bold">{history.length}</p>
          </div>
          <div className="rounded-xl bg-zinc-900 p-3">
            <p className="inline-flex items-center gap-1 text-zinc-400">
              <Trophy size={14} />
              Evolved title
            </p>
            <p className="text-lg font-semibold">{evolveTitle(elo)}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Accuracy</th>
                <th className="px-3 py-2">Aura</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((game, index) => (
                <tr key={`${game.playedAt}-${index}`} className="border-t border-zinc-800">
                  <td className="px-3 py-2">{game.result === "white" ? "Win" : game.result === "black" ? "Lose" : "Draw"}</td>
                  <td className="px-3 py-2">{game.accuracy ? `${game.accuracy.toFixed(1)}%` : "-"}</td>
                  <td className="px-3 py-2">{game.auraDelta > 0 ? `+${game.auraDelta}` : game.auraDelta}</td>
                  <td className="px-3 py-2">{game.title}</td>
                  <td className="px-3 py-2">{new Date(game.playedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td className="px-3 py-6 text-center text-zinc-500" colSpan={5}>
                    No games yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
