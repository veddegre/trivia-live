"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { DISPLAY_NAME_KEY } from "@/lib/types";

function JoinInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fromQuery = (search.get("code") || "").trim().toUpperCase();
    if (fromQuery) setCode(fromQuery);
    try {
      const saved = localStorage.getItem(DISPLAY_NAME_KEY);
      if (saved) setName(saved);
    } catch {
      /* ignore */
    }
  }, [search]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!c) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`/api/games/by-code/${encodeURIComponent(c)}`);
      if (!res.ok) {
        setError(
          "Game not found — that code isn’t active. Check the host screen / QR (codes change when a game is recycled)."
        );
        return;
      }
      const data = await res.json();
      if (data.game?.status === "DRAFT") {
        setError("Lobby isn’t open yet — wait for the host.");
        return;
      }
      if (data.game?.status === "FINISHED") {
        setError("That game has finished — ask the host to hit Play again.");
        return;
      }
      if (data.game?.allowLateJoin === false && data.game?.status !== "LOBBY") {
        setError("This game isn’t accepting late joins.");
        return;
      }
      if (n) {
        try {
          localStorage.setItem(DISPLAY_NAME_KEY, n);
        } catch {
          /* ignore */
        }
      }
      const q = n ? `?name=${encodeURIComponent(n)}` : "";
      router.push(`/play/${c}${q}`);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-12"
      style={{ background: "#050a14", color: "#ffffff" }}
    >
      <div className="flex justify-center">
        <BrandMark href="/" size="lg" />
      </div>

      <div className="mt-10 text-center">
        <h1 className="display text-[2.5rem] leading-none tracking-tight">Join game</h1>
        <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-snug" style={{ color: "#9aa6c1" }}>
          Enter the game code and your display name to join the live trivia!
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-10 flex flex-1 flex-col gap-5">
        <label className="block space-y-2">
          <span
            className="block text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#f8b43c" }}
          >
            Game code
          </span>
          <input
            className="w-full rounded-xl border bg-[#0a1220] px-4 py-3.5 text-center font-bold uppercase tracking-[0.35em] outline-none"
            style={{
              borderColor: "#f8b43c",
              color: "#f8b43c",
              fontSize: "1.5rem",
            }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="ABC123"
            autoComplete="off"
            required
          />
        </label>
        <label className="block space-y-2">
          <span
            className="block text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#f8b43c" }}
          >
            Display name
          </span>
          <input
            className="w-full rounded-xl border bg-[#0a1220] px-4 py-3.5 text-[17px] font-semibold text-white outline-none"
            style={{ borderColor: "#2a3550" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Your name"
            autoFocus={!!code}
          />
        </label>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button
          type="submit"
          className="mt-2 w-full rounded-xl py-4 text-base font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg, #ffc14d 0%, #f8b43c 55%, #e09a20 100%)",
            color: "#1a1200",
          }}
          disabled={checking}
        >
          {checking ? "Checking…" : "Continue"}
        </button>
      </form>

      <p
        className="relative z-10 mt-8 flex items-start justify-center gap-2 text-center text-xs leading-snug"
        style={{ color: "#8b95a8" }}
      >
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: "#f8b43c" }}
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2 4 5v6c0 5.25 3.4 10.15 8 11.35C16.6 21.15 20 16.25 20 11V5l-8-3zm-1.1 14.2-3.6-3.6 1.4-1.4 2.2 2.2 4.5-4.5 1.4 1.4-5.9 5.9z" />
        </svg>
        <span>Your name will be shown to other players in the game.</span>
      </p>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 100%, rgba(248,180,60,0.28) 0%, transparent 70%)",
        }}
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-[140%] -translate-x-1/2 opacity-40"
        viewBox="0 0 400 120"
        fill="none"
      >
        <ellipse cx="200" cy="110" rx="170" ry="14" stroke="rgba(248,180,60,0.5)" strokeWidth="1.5" />
        <ellipse cx="200" cy="90" rx="130" ry="18" stroke="rgba(248,180,60,0.3)" strokeWidth="1" />
        <ellipse cx="200" cy="68" rx="90" ry="20" stroke="rgba(248,180,60,0.18)" strokeWidth="1" />
      </svg>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-10" style={{ background: "#050a14", color: "#9aa6c1" }}>
          Loading…
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
