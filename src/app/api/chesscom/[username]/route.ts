import { NextResponse } from "next/server";

type ChessComGame = {
  uuid: string;
  time_class: string;
  pgn: string;
  end_time: number;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
  accuracies?: { white?: string; black?: string };
};

export async function GET(_: Request, context: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await context.params;
    const normalized = String(username ?? "").trim().toLowerCase();
    if (!normalized) return NextResponse.json({ error: "username required" }, { status: 400 });

    const archiveRes = await fetch(`https://api.chess.com/pub/player/${normalized}/games/archives`, {
      headers: { "User-Agent": "sigma-chess-review/1.0" },
      cache: "no-store",
    });
    if (!archiveRes.ok) {
      return NextResponse.json({ error: "Could not fetch chess.com archives" }, { status: 404 });
    }

    const archiveData = (await archiveRes.json()) as { archives: string[] };
    const archives = [...(archiveData.archives ?? [])].reverse();
    const games: ChessComGame[] = [];

    for (const archiveUrl of archives) {
      if (games.length >= 120) break;
      const monthRes = await fetch(archiveUrl, {
        headers: { "User-Agent": "sigma-chess-review/1.0" },
        cache: "no-store",
      });
      if (!monthRes.ok) continue;
      const monthData = (await monthRes.json()) as { games: ChessComGame[] };
      for (const game of monthData.games ?? []) {
        if (game.pgn) games.push(game);
      }
    }

    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ error: "Failed to fetch chess.com games" }, { status: 500 });
  }
}
