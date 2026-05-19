"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, Globe, Link2Off, RotateCcw, Sparkles, Swords, Trophy, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { CardOpening } from "@/components/CardOpening";
import { RankCardModal } from "@/components/RankCardModal";
import { MatchResultModal } from "@/components/MatchResultModal";
import { useChessGame } from "@/hooks/useChessGame";
import type { AiPreset } from "@/hooks/useChessGame";
import { hasSupabaseEnv, supabaseClient } from "@/lib/supabase/client";
import { evolveTitle } from "@/lib/rating";
import { getBookMove } from "@/lib/openingBook";
import type { GameRecordPayload, GachaCard } from "@/types/game";
import type { Square } from "chess.js";

type GameMode = "human" | "ai" | "online";

type ProfileState = {
  id: string;
  username: string;
  elo: number | null;
  aura_points: number;
  current_title: string;
  games_played: number;
  calibrated: boolean;
};

const defaultProfile: ProfileState = {
  id: "local-player",
  username: "Local Sigma",
  elo: null,
  aura_points: 0,
  current_title: "Unranked",
  games_played: 0,
  calibrated: false,
};

const aiPresets: AiPreset[] = [
  { id: "meme-speedrun", name: "Meme Speedrun", depth: 7, moveTime: 350, skillLevel: 5 },
  { id: "sigma-grinder", name: "Sigma Grinder", depth: 10, moveTime: 800, skillLevel: 10 },
  { id: "hikaru-mode", name: "Hikaru Mode", depth: 14, moveTime: 1400, skillLevel: 16 },
  { id: "gigachad-bot", name: "GigaChad Bot", depth: 17, moveTime: 2200, skillLevel: 20 },
];

type ChessArenaProps = {
  initialMode?: GameMode;
};

type LocalGameHistoryEntry = {
  playedAt: number;
  result: "white" | "black" | "draw";
  pgn: string;
  auraDelta: number;
  title: string;
  accuracy?: number;
};

export const ChessArena = ({ initialMode = "ai" }: ChessArenaProps) => {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState>(() => {
    if (typeof window === "undefined") return defaultProfile;
    const raw = localStorage.getItem("sigma-game-history");
    const parsed = raw ? (JSON.parse(raw) as LocalGameHistoryEntry[]) : [];
    return { ...defaultProfile, games_played: parsed.length };
  });
  const [savedCards, setSavedCards] = useState<GachaCard[]>([]);
  const [syncInfo, setSyncInfo] = useState("Offline mode");
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const [boardPx, setBoardPx] = useState(680);
  const [rankCard, setRankCard] = useState<{ open: boolean; elo: number; title: string; description: string }>({
    open: false,
    elo: 900,
    title: "Unranked",
    description: "",
  });
  const [connectedRoom, setConnectedRoom] = useState("");
  const [onlineStatus, setOnlineStatus] = useState("Not connected");
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  const [timeControl, setTimeControl] = useState<"10|0" | "3|2" | "5|5">("10|0");
  const [matchId, setMatchId] = useState<string>("");
  const [onlineColor, setOnlineColor] = useState<"w" | "b" | null>(null);
  const [whiteMs, setWhiteMs] = useState(10 * 60 * 1000);
  const [blackMs, setBlackMs] = useState(10 * 60 * 1000);
  const onlineChannelRef = useRef<ReturnType<NonNullable<typeof supabaseClient>["channel"]> | null>(null);
  const [userTag] = useState(() => `u-${Date.now().toString(36).slice(-6)}`);

  const saveGame = useCallback(async (payload: GameRecordPayload, card?: GachaCard) => {
    const nextGamesPlayed = profile.games_played + 1;
    const title = profile.calibrated && profile.elo ? evolveTitle(profile.elo, payload.stats) : profile.current_title;
    const localEntry: LocalGameHistoryEntry = {
      playedAt: Date.now(),
      result: payload.result,
      pgn: payload.pgn,
      auraDelta: payload.sigmaVerdict.auraDelta,
      title,
      accuracy: payload.stats?.userAccuracy,
    };
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("sigma-game-history");
      const parsed = raw ? (JSON.parse(raw) as LocalGameHistoryEntry[]) : [];
      localStorage.setItem("sigma-game-history", JSON.stringify([localEntry, ...parsed].slice(0, 200)));
    }

    // Calibration: after 5 games, ask AI for estimated ELO + unique title card.
    if (!profile.calibrated && nextGamesPlayed >= 5) {
      const raw = typeof window !== "undefined" ? localStorage.getItem("sigma-game-history") : null;
      const parsed = raw ? (JSON.parse(raw) as LocalGameHistoryEntry[]) : [];
      const lastFive = [localEntry, ...parsed].slice(0, 5).map((g) => ({
        pgn: g.pgn,
        result: g.result,
        accuracy: g.accuracy,
      }));
      try {
        const res = await fetch("/api/rank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ games: lastFive, currentElo: profile.elo }),
        });
        if (res.ok) {
          const data = (await res.json()) as { elo: number; title: string; description: string };
          setProfile((prev) => ({ ...prev, elo: data.elo, current_title: data.title, calibrated: true }));
          setRankCard({ open: true, elo: data.elo, title: data.title, description: data.description });
        }
      } catch {
        // ignore, keep unranked
      }
    }

    if (!supabaseClient) {
      if (card) setSavedCards((prev) => [card, ...prev]);
      setProfile((prev) => ({
        ...prev,
        games_played: nextGamesPlayed,
        aura_points: prev.aura_points + payload.sigmaVerdict.auraDelta,
        current_title: prev.current_title,
      }));
      return;
    }

    const client = supabaseClient;
    const { data: authData } = await client.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return;

    await client.from("games").insert({
      user_id: userId,
      pgn: payload.pgn,
      result: payload.result,
      verdict: payload.sigmaVerdict.verdict,
      title: payload.sigmaVerdict.title,
      aura_delta: payload.sigmaVerdict.auraDelta,
    });

    await client
      .from("profiles")
      .update({
        current_title: profile.current_title,
        aura_points: profile.aura_points + payload.sigmaVerdict.auraDelta,
        elo: profile.elo ?? 1200,
      })
      .eq("id", userId);

    if (card) {
      const { data: cardRow } = await client
        .from("cards")
        .select("id")
        .eq("name", card.name)
        .maybeSingle();
      if (cardRow?.id) {
        await client.from("user_cards").insert({ user_id: userId, card_id: cardRow.id });
      }
      setSavedCards((prev) => [card, ...prev]);
    }

    setProfile((prev) => ({
      ...prev,
      games_played: nextGamesPlayed,
      aura_points: prev.aura_points + payload.sigmaVerdict.auraDelta,
      current_title: prev.current_title,
    }));
  }, [profile.aura_points, profile.calibrated, profile.current_title, profile.elo, profile.games_played]);

  const {
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
    onDrop,
    resetGame,
    getMoveOptions,
    clearMoveOptions,
    setGameMode,
    setAiPreset,
    setIsResultOpen,
    setWonCard,
    undoMove,
    redoMove,
    canRedo,
    applyExternalMove,
    moveHistorySan,
  } = useChessGame({ onSaveGame: saveGame });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        undoMove();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        redoMove();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redoMove, undoMove]);

  useEffect(() => {
    const enforceAuth = async () => {
      if (!supabaseClient || !hasSupabaseEnv) return;
      const { data } = await supabaseClient.auth.getUser();
      if (!data.user) router.replace("/auth");
    };
    void enforceAuth();
  }, [router]);

  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const width = el.getBoundingClientRect().width;
      setBoardPx(Math.max(280, Math.min(760, Math.floor(width))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setGameMode(initialMode);
  }, [initialMode, setGameMode]);

  const openAnalysis = useCallback(() => {
    if (!reviewData || !judgeState.result) return;
    sessionStorage.setItem(
      "sigma-review",
      JSON.stringify({
        review: reviewData,
        judge: judgeState.result,
        savedAt: Date.now(),
      }),
    );
    setIsResultOpen(false);
    router.push("/review");
  }, [judgeState.result, reviewData, router, setIsResultOpen]);

  const timeControlConfig = useMemo(() => {
    const [minutesText, incrementText] = timeControl.split("|");
    const baseMs = Number(minutesText) * 60 * 1000;
    const incrementMs = Number(incrementText) * 1000;
    return { baseMs, incrementMs };
  }, [timeControl]);

  const disconnectOnlineRoom = async () => {
    if (supabaseClient && onlineChannelRef.current) {
      await supabaseClient.removeChannel(onlineChannelRef.current);
    }
    onlineChannelRef.current = null;
    setConnectedRoom("");
    setOnlineStatus("Not connected");
    setMatchId("");
    setOnlineColor(null);
  };

  const attachOnlineMatch = useCallback(async (incomingMatchId: string, baseMs: number) => {
      if (!supabaseClient) return;
      const { data: authData } = await supabaseClient.auth.getUser();
      const currentUserId = authData.user?.id;
      if (!currentUserId) return;
      const { data: matchRow } = await supabaseClient
        .from("online_matches")
        .select("id, white_user_id, black_user_id")
        .eq("id", incomingMatchId)
        .maybeSingle();
      if (!matchRow) return;

      const myColor: "w" | "b" = matchRow.white_user_id === currentUserId ? "w" : "b";
      setOnlineColor(myColor);
      setMatchId(incomingMatchId);
      setConnectedRoom(incomingMatchId);
      setWhiteMs(baseMs);
      setBlackMs(baseMs);

      if (onlineChannelRef.current) await supabaseClient.removeChannel(onlineChannelRef.current);
      const channel = supabaseClient.channel(`match:${incomingMatchId}`);
      channel.on("broadcast", { event: "move" }, (payload) => {
        const data = payload.payload as {
          from: string;
          to: string;
          promotion?: string;
          by: string;
          whiteMs: number;
          blackMs: number;
        };
        if (!data || data.by === userTag) return;
        applyExternalMove(data.from, data.to, data.promotion);
        setWhiteMs(data.whiteMs);
        setBlackMs(data.blackMs);
      });
      channel.on("broadcast", { event: "reset" }, (payload) => {
        const data = payload.payload as { by: string };
        if (data?.by === userTag) return;
        resetGame();
        setWhiteMs(baseMs);
        setBlackMs(baseMs);
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setOnlineStatus(`Matched! You play ${myColor === "w" ? "White" : "Black"}`);
        }
      });
      onlineChannelRef.current = channel;
  }, [applyExternalMove, resetGame, userTag]);

  const connectOnlineRoom = async () => {
    if (!supabaseClient || !hasSupabaseEnv) {
      setOnlineStatus("Realtime unavailable: Supabase env missing");
      return;
    }
    setMatchmakingLoading(true);
    setOnlineStatus(`Finding opponent for ${timeControl}...`);
    const { data, error } = await supabaseClient.rpc("join_matchmaking", { p_time_control: timeControl });
    setMatchmakingLoading(false);
    if (error) {
      setOnlineStatus("Matchmaking failed.");
      return;
    }
    const nextMatchId = (data as string | null) ?? null;
    if (nextMatchId) {
      await attachOnlineMatch(nextMatchId, timeControlConfig.baseMs);
    } else {
      setOnlineStatus("Waiting for opponent...");
    }
  };

  useEffect(() => {
    if (gameMode !== "online" || matchId || onlineStatus !== "Waiting for opponent...") return;
    if (!supabaseClient) return;
   let active = true;
    const timer = setInterval(async () => {
      if (!supabaseClient) return;
        const { data, error } = await supabaseClient.rpc("join_matchmaking", { p_time_control: timeControl });
      if (!active || error) return;
      const nextMatchId = (data as string | null) ?? null;
      if (nextMatchId) {
        clearInterval(timer);
        await attachOnlineMatch(nextMatchId, timeControlConfig.baseMs);
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [attachOnlineMatch, gameMode, matchId, onlineStatus, timeControl, timeControlConfig.baseMs]);

  useEffect(() => {
    const bootAuth = async () => {
      if (!hasSupabaseEnv || !supabaseClient) return;

      const client = supabaseClient;
      const current = await client.auth.getUser();
      if (!current.data.user) {
        router.replace("/auth");
        return;
      }
      const data = current.data;

      const userId = data.user.id;
      const { data: profileRow } = await client
        .from("profiles")
        .select("id, username, elo, aura_points, current_title")
        .eq("id", userId)
        .maybeSingle();

      if (!profileRow) {
        await client.from("profiles").insert({
          id: userId,
          username: String(data.user.user_metadata?.username ?? `sigma_${userId.slice(0, 5)}`),
          elo: 1200,
          aura_points: 0,
          current_title: "Fresh Sigma",
        });
        setProfile({
          ...defaultProfile,
          id: userId,
          username: String(data.user.user_metadata?.username ?? `sigma_${userId.slice(0, 5)}`),
        });
     } else {
  setProfile((prev) => {
    if (!prev) return prev; // если стейт профиля вдруг null, возвращаем его
    return { 
      ...prev,           // сначала разворачиваем старый стейт (там лежит calibrated)
      ...profileRow,      // поверх накатываем новые данные из базы данных
      games_played: prev.games_played // сохраняем старое количество игр, как у тебя и было
    };
  });
}

      setSyncInfo("Supabase sync enabled");
    };

    void bootAuth();
  }, [router]);

  useEffect(() => {
    return () => {
      if (supabaseClient && onlineChannelRef.current) {
        void supabaseClient.removeChannel(onlineChannelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameMode !== "online" || !matchId) return;
    const interval = setInterval(() => {
      const sideToMove = fen.split(" ")[1] as "w" | "b";
      if (sideToMove === "w") {
        setWhiteMs((prev) => Math.max(0, prev - 1000));
      } else {
        setBlackMs((prev) => Math.max(0, prev - 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fen, gameMode, matchId]);

  const formatClock = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    Object.entries(legalMoves).forEach(([square, targets]) => {
      styles[square] = {
        background: "radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 70%)",
      };
      targets.forEach((target) => {
        styles[target] = {
          background: "radial-gradient(circle, rgba(56,189,248,0.45) 0%, transparent 70%)",
          borderRadius: "50%",
        };
      });
    });
    return styles;
  }, [legalMoves]);
  const bookMove = useMemo(() => getBookMove(moveHistorySan), [moveHistorySan]);

  useEffect(() => {
    const finalizeOnlineMatch = async () => {
      if (!supabaseClient || gameMode !== "online" || !matchId || !reviewData) return;
      const result =
        reviewData.resultText.includes("won")
          ? "white"
          : reviewData.resultText.includes("lost")
            ? "black"
            : "draw";
      await supabaseClient
        .from("online_matches")
        .update({
          status: "finished",
          result,
          pgn: reviewData.moves.map((move, index) => `${index + 1}.${move.san}`).join(" "),
          finished_at: new Date().toISOString(),
        })
        .eq("id", matchId);
    };
    void finalizeOnlineMatch();
  }, [gameMode, matchId, reviewData]);

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 p-4 md:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Sigma Chess</h1>
            <p className="text-sm text-zinc-400">{modeLabel}</p>
            <p className="text-xs text-zinc-500">AI: {aiPreset.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">
              Back
            </button>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles size={14} />
            {syncInfo}
            </div>
          </div>
        </div>

        <div ref={boardWrapRef} className="mx-auto w-full max-w-2xl">
          <Chessboard
            options={{
              id: "sigma-board",
              position: fen,
              boardStyle: { width: boardPx, height: boardPx, maxWidth: "100%" },
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (!sourceSquare || !targetSquare) return false;
                const moverSide = fen.split(" ")[1] as "w" | "b";
                const ok = onDrop(sourceSquare, targetSquare);
                if (ok && gameMode === "online" && onlineChannelRef.current) {
                  let nextWhite = whiteMs;
                  let nextBlack = blackMs;
                  if (moverSide === "w") {
                    nextWhite += timeControlConfig.incrementMs;
                  } else {
                    nextBlack += timeControlConfig.incrementMs;
                  }
                  setWhiteMs(nextWhite);
                  setBlackMs(nextBlack);
                  void onlineChannelRef.current.send({
                    type: "broadcast",
                    event: "move",
                    payload: { from: sourceSquare, to: targetSquare, by: userTag, whiteMs: nextWhite, blackMs: nextBlack },
                  });
                }
                return ok;
              },
              onPieceDrag: ({ square }) => (square ? getMoveOptions(square as Square) : false),
              canDragPiece: ({ piece }) => {
                if (!piece) return false;
                const pieceCode =
                  typeof piece === "string"
                    ? piece
                    : typeof piece === "object" && piece !== null && "pieceType" in piece
                      ? String(piece.pieceType)
                      : "";
                if (gameMode === "ai") {
                  // In vs AI mode user controls only white pieces.
                  return pieceCode.toLowerCase().startsWith("w");
                }
                if (gameMode === "online") {
                  if (!onlineColor) return false;
                  const isWhitePiece = pieceCode.toLowerCase().startsWith("w");
                  const playerColorMatches = onlineColor === "w" ? isWhitePiece : !isWhitePiece;
                  const sideToMove = fen.split(" ")[1];
                  return playerColorMatches && sideToMove === onlineColor;
                }
                return true;
              },
              onMouseOutSquare: () => clearMoveOptions(),
              squareStyles: customSquareStyles,
              darkSquareStyle: { backgroundColor: "#2f2f39" },
              lightSquareStyle: { backgroundColor: "#f0f0f3" },
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
          >
            <Swords size={16} />
            Back to menu
          </button>
          <button
            onClick={() => {
              resetGame();
              setWhiteMs(timeControlConfig.baseMs);
              setBlackMs(timeControlConfig.baseMs);
              if (gameMode === "online" && onlineChannelRef.current) {
                void onlineChannelRef.current.send({
                  type: "broadcast",
                  event: "reset",
                  payload: { by: userTag },
                });
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
          >
            <RotateCcw size={16} />
            Reset match
          </button>
          {gameMode === "ai" && (
            <select
              value={aiPreset.id}
              onChange={(e) => {
                const preset = aiPresets.find((p) => p.id === e.target.value);
                if (preset) setAiPreset(preset);
              }}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none"
            >
              {aiPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          )}
          {gameMode === "online" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-500/10 p-2">
              <Globe size={16} className="text-sky-300" />
              <select
                value={timeControl}
                onChange={(e) => setTimeControl(e.target.value as "10|0" | "3|2" | "5|5")}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              >
                <option value="10|0">10|0</option>
                <option value="3|2">3|2</option>
                <option value="5|5">5|5</option>
              </select>
              <button
                onClick={connectOnlineRoom}
                disabled={matchmakingLoading || Boolean(matchId)}
                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-50"
              >
                {matchmakingLoading ? "Searching..." : "Find match"}
              </button>
              <button onClick={disconnectOnlineRoom} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
                <Link2Off size={12} />
                Leave
              </button>
              <span className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200">W {formatClock(whiteMs)}</span>
              <span className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200">B {formatClock(blackMs)}</span>
              <p className="text-xs text-sky-200">{onlineStatus}</p>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Trophy size={18} />
            Player Profile
          </h2>
          <button
            onClick={() => router.push("/profile")}
            className="mb-2 inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
          >
            <User size={12} />
            Open profile
          </button>
          <p className="text-sm text-zinc-300">@{profile.username}</p>
            <p className="text-sm text-zinc-400">ELO: {profile.calibrated && profile.elo ? profile.elo : "Unrated"}</p>
            <p className="text-xs text-zinc-500">
              {profile.games_played < 5
                ? `Calibration: ${profile.games_played}/5 games`
                : "Ranked calibration completed"}
            </p>
          <p className="text-sm text-zinc-400">Aura: {profile.aura_points}</p>
          <p className="mt-2 rounded-xl bg-zinc-800 p-2 text-sm">{profile.current_title}</p>
          {gameMode === "online" && connectedRoom && (
            <p className="mt-2 text-xs text-sky-300">Room: {connectedRoom}</p>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="text-lg font-semibold">Game Feed</h2>
          <p className="mt-2 text-sm text-zinc-300">{status}</p>
          {bookMove && <p className="mt-1 text-xs text-emerald-300">Book move suggestion: {bookMove}</p>}
          {aiThinking && <p className="text-sm text-sky-300">Stockfish thinks with 1000 IQ...</p>}
          {judgeState.loading && (
            <p className="mt-2 text-sm text-amber-300">Match finished. Sigma Judge is preparing review...</p>
          )}
          {!judgeState.loading && reviewData && (
            <button
              onClick={openAnalysis}
              className="mt-3 rounded-xl bg-fuchsia-500/20 px-3 py-2 text-sm text-fuchsia-200 hover:bg-fuchsia-500/30"
            >
              Open match review
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={undoMove} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
              <ChevronLeft size={14} />
              Undo
            </button>
            <button
              onClick={redoMove}
              disabled={!canRedo}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={14} />
              Redo
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="text-lg font-semibold">Gacha Collection</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {savedCards.slice(0, 6).map((card, index) => (
              <div key={`${card.id}-${index}`} className="rounded-xl bg-zinc-900 p-2 text-xs">
                <p className="font-semibold">{card.name}</p>
                <p className="text-zinc-400">{card.rarity}</p>
              </div>
            ))}
            {savedCards.length === 0 && <p className="text-sm text-zinc-400">Win a game to open a pack.</p>}
          </div>
        </div>
      </aside>

      <CardOpening card={wonCard} onClose={() => setWonCard(null)} />
      <RankCardModal
        open={rankCard.open}
        elo={rankCard.elo}
        title={rankCard.title}
        description={rankCard.description}
        onClose={() => setRankCard((prev) => ({ ...prev, open: false }))}
      />
      <MatchResultModal
        open={isResultOpen}
        review={reviewData}
        judgeVerdict={judgeState.result?.verdict}
        loadingJudge={judgeState.loading || !judgeState.result}
        onClose={() => setIsResultOpen(false)}
        onNewGame={resetGame}
        onAnalyze={openAnalysis}
      />
    </div>
  );
};
