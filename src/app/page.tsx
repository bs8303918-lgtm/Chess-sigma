"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Camera, Globe, ShieldCheck, Swords, Trophy } from "lucide-react";
import { hasSupabaseEnv, supabaseClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(!hasSupabaseEnv);

  useEffect(() => {
    const checkSession = async () => {
      if (!hasSupabaseEnv || !supabaseClient) return;
      const { data } = await supabaseClient.auth.getUser();
      if (!data.user) {
        router.replace("/auth");
        return;
      }
      setReady(true);
    };
    void checkSession();
  }, [router]);

  if (!ready) {
    return <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">Loading...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col p-6">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-fuchsia-950/20 p-8">
        <p className="inline-flex rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
          Free chess review + AI Judge
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Sigma Chess</h1>
        <p className="mt-3 max-w-3xl text-zinc-300">
          Играй локально, онлайн или против бота. После матча открывай review в стиле chess.com, получай AI Judge
          вердикт и коллекционируй карточки.
        </p>
        <div className="mt-4">
          <Link href="/auth" className="rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700">
            Register / Login
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Link href="/play/local" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-zinc-600">
          <p className="inline-flex items-center gap-2 text-lg font-semibold">
            <Swords size={18} />
            Play Local
          </p>
          <p className="mt-2 text-sm text-zinc-400">Два игрока за одной доской.</p>
        </Link>
        <Link href="/play/online" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-zinc-600">
          <p className="inline-flex items-center gap-2 text-lg font-semibold">
            <Globe size={18} />
            Play Online
          </p>
          <p className="mt-2 text-sm text-zinc-400">Быстрый онлайн-режим (beta).</p>
        </Link>
        <Link href="/play/bot" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-zinc-600">
          <p className="inline-flex items-center gap-2 text-lg font-semibold">
            <Bot size={18} />
            Play vs Bot
          </p>
          <p className="mt-2 text-sm text-zinc-400">Stockfish пресеты сложности.</p>
        </Link>
        <Link href="/review/import" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-zinc-600">
          <p className="inline-flex items-center gap-2 text-lg font-semibold">
            <Camera size={18} />
            Review Match
          </p>
          <p className="mt-2 text-sm text-zinc-400">Фото доски или chess.com username.</p>
        </Link>
        <Link href="/profile" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-zinc-600">
          <p className="inline-flex items-center gap-2 text-lg font-semibold">
            <Trophy size={18} />
            Profile & Rank
          </p>
          <p className="mt-2 text-sm text-zinc-400">ELO, эволюция титула и история матчей.</p>
        </Link>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="inline-flex items-center gap-2 font-semibold">
            <ShieldCheck size={16} />
            AI Judge titles
          </p>
          <p className="mt-2 text-sm text-zinc-400">Рейтинг + мемный тайтл по последним матчам.</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="inline-flex items-center gap-2 font-semibold">
            <Trophy size={16} />
            Ranked progression
          </p>
          <p className="mt-2 text-sm text-zinc-400">Aura points и персональное призвание игрока.</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="inline-flex items-center gap-2 font-semibold">
            <Swords size={16} />
            Collect cards
          </p>
          <p className="mt-2 text-sm text-zinc-400">Выбивай редкие карты после побед.</p>
        </div>
      </section>
    </main>
  );
}
