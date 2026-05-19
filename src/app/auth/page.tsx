"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabaseEnv, supabaseClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    if (!supabaseClient || !hasSupabaseEnv) {
      setMessage("Supabase env is missing. Running in offline mode.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (!error && data.user) {
      await supabaseClient.from("profiles").upsert({
        id: data.user.id,
        username: username || `sigma_${data.user.id.slice(0, 5)}`,
      });
    }
    setLoading(false);
    setMessage(error ? error.message : "Registration done. Check email if confirmation enabled.");
  };

  const signIn = async () => {
    if (!supabaseClient || !hasSupabaseEnv) {
      setMessage("Supabase env is missing. Running in offline mode.");
      return;
    }
    setLoading(true);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-4">
      <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h1 className="text-2xl font-bold">Profile Access</h1>
        <p className="mt-1 text-sm text-zinc-400">Create account for online games and rank progression.</p>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <input
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={signIn} disabled={loading} className="rounded-xl bg-zinc-800 py-2 text-sm hover:bg-zinc-700">
            Sign in
          </button>
          <button onClick={signUp} disabled={loading} className="rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-black hover:bg-emerald-400">
            Register
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-zinc-400">{message}</p>}
      </div>
    </main>
  );
}
