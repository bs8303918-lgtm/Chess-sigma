"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Home, Search, UserRound } from "lucide-react";
import { buildReviewFromPgn } from "@/lib/review";
import type { SigmaJudgeResult } from "@/types/game";
type ChessComGame = {
  uuid: string;
  time_class: string;
  pgn: string;
  end_time: number;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
  accuracies?: { white?: string; black?: string };
};

export default function ImportReviewPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState("");
  const [photoBestMove, setPhotoBestMove] = useState("");
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedUsername = username.trim().toLowerCase();
  const visibleGames = useMemo(() => games.slice(0, visibleCount), [games, visibleCount]);

  const fetchGames = async () => {
    if (!normalizedUsername) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/chesscom/${normalizedUsername}`);
      if (!response.ok) throw new Error("Username not found on chess.com");
      const data = (await response.json()) as { games: ChessComGame[] };
      const collected = data.games ?? [];

      setGames(collected);
      setSelectedGameId(collected[0]?.uuid ?? "");
      setVisibleCount(10);
      if (!collected.length) setError("No games found for this profile.");
    } catch (e) {
      setGames([]);
      setSelectedGameId("");
      setError(e instanceof Error ? e.message : "Could not load games.");
    } finally {
      setLoading(false);
    }
  };

  const analyzePhoto = async () => {
    if (!photoFile) return;
    setLoading(true);
    setError("");
    setPhotoNote("");
    setPhotoBestMove("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(photoFile);
      });
      const response = await fetch("/api/review-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!response.ok) throw new Error("Photo analysis failed");
      const data = (await response.json()) as { bestMove: string; recommendation: string };
      setPhotoBestMove(data.bestMove);
      setPhotoNote(data.recommendation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze photo.");
    } finally {
      setLoading(false);
    }
  };

  const startReview = () => {
    const selected = games.find((game) => game.uuid === selectedGameId);
    if (!selected?.pgn) return;
    let review;
    try {
      review = buildReviewFromPgn(selected.pgn);
    } catch {
      setError("Could not parse this game for review.");
      return;
    }
    const judge: SigmaJudgeResult = {
      title: "Pattern Hunter",
      verdict: `AI Judge checked ${normalizedUsername || "imported profile"} game. Good tactical instincts, improve opening consistency and conversion.`,
      auraDelta: 18,
    };
    sessionStorage.setItem("sigma-review", JSON.stringify({ review, judge, savedAt: Date.now() }));
    router.push("/review");
  };

  const movesCountFromPgn = (pgn: string) => {
    const hits = pgn.match(/\d+\./g);
    return hits ? hits.length : 0;
  };

  const scoreBadge = (game: ChessComGame) => {
    const isWhite = game.white.username.toLowerCase() === normalizedUsername;
    const me = isWhite ? game.white : game.black;
    if (me.result === "win") return { text: "+", tone: "bg-lime-500/20 text-lime-300" };
    if (["agreed", "repetition", "stalemate", "timevsinsufficient", "insufficient"].includes(me.result)) {
      return { text: "=", tone: "bg-zinc-500/20 text-zinc-300" };
    }
    return { text: "-", tone: "bg-rose-500/20 text-rose-300" };
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-4 md:p-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Review Match</h1>
            <p className="text-sm text-zinc-400">Upload board photo or enter chess.com account to analyze last games.</p>
          </div>
          <button onClick={() => router.push("/")} className="rounded-xl bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
            <Home size={14} className="mr-1 inline" />
            Home
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="mb-2 inline-flex items-center gap-2 font-semibold">
              <Camera size={16} />
              Upload photo
            </p>
            <label className="block cursor-pointer rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-3 py-5 text-center text-sm text-zinc-300 hover:border-zinc-500">
              Select board image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPhotoFile(file);
                  setPhotoName(file?.name ?? "");
                }}
              />
            </label>
            <p className="mt-2 text-xs text-zinc-500">
              {photoName ? `Selected: ${photoName}` : "Upload board photo for AI analysis."}
            </p>
            <button
              onClick={analyzePhoto}
              disabled={!photoFile || loading}
              className="mt-3 w-full rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700 disabled:opacity-40"
            >
              Analyze photo
            </button>
            {photoBestMove && <p className="mt-2 text-xs text-sky-300">Best move: {photoBestMove}</p>}
            {photoNote && <p className="mt-1 text-xs text-emerald-300">{photoNote}</p>}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="mb-2 inline-flex items-center gap-2 font-semibold">
              <UserRound size={16} />
              Chess.com username
            </p>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="hikaru"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
              <button onClick={fetchGames} disabled={loading} className="rounded-xl bg-zinc-800 px-3 hover:bg-zinc-700 disabled:opacity-50">
                <Search size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Loads games from chess.com public profile archives.</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
          <p className="text-xl font-bold">Game History ({games.length})</p>
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
          <div
            className="mt-3 max-h-[420px] overflow-y-auto rounded-xl border border-zinc-800"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24 && visibleCount < games.length) {
                setVisibleCount((prev) => Math.min(games.length, prev + 5));
              }
            }}
          >
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Players</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Accuracy</th>
                  <th className="px-3 py-2">Moves</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleGames.map((game) => {
                  const badge = scoreBadge(game);
                  const isWhite = game.white.username.toLowerCase() === normalizedUsername;
                  const accuracy = isWhite ? game.accuracies?.white : game.accuracies?.black;
                  return (
                    <tr
                      key={game.uuid}
                      className={`cursor-pointer border-t border-zinc-800 ${selectedGameId === game.uuid ? "bg-fuchsia-500/10" : "hover:bg-zinc-900/70"}`}
                      onClick={() => setSelectedGameId(game.uuid)}
                    >
                      <td className="px-3 py-2">
                        <p className="font-semibold">{game.white.username} ({game.white.rating})</p>
                        <p className="text-zinc-400">{game.black.username} ({game.black.rating})</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md font-bold ${badge.tone}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-3 py-2">{accuracy ? Number(accuracy).toFixed(1) : "-"}</td>
                      <td className="px-3 py-2">{movesCountFromPgn(game.pgn)}</td>
                      <td className="px-3 py-2">{new Date(game.end_time * 1000).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {!games.length && !loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                      Enter username and click search to load games.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loading && <p className="mt-2 text-sm text-zinc-400">Loading games...</p>}
          {visibleCount < games.length && (
            <p className="mt-2 text-xs text-zinc-500">Scroll down to load 5 more games.</p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={startReview}
              disabled={!selectedGameId}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600 disabled:opacity-40"
            >
              Review
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
