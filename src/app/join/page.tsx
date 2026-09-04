"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { assertDisplayName } from "@/lib/display-name";
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
    let displayName = name.trim();
    if (!c) return;
    setChecking(true);
    setError("");
    try {
      if (displayName) {
        displayName = assertDisplayName(displayName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick another display name.");
      setChecking(false);
      return;
    }
    try {
      const res = await fetch(`/api/games/by-code/${encodeURIComponent(c)}`, {
        cache: "no-store",
      });
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
      if (displayName) {
        try {
          localStorage.setItem(DISPLAY_NAME_KEY, displayName);
        } catch {
          /* ignore */
        }
      }
      const q = displayName ? `?name=${encodeURIComponent(displayName)}` : "";
      router.push(`/play/${c}${q}`);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-ink px-6 pb-10 pt-12 text-chalk"
    >
      <div className="flex justify-center">
        <BrandMark href="/" size="lg" />
      </div>

      <div className="mt-10 text-center">
        <h1 className="display text-[2.5rem] leading-none tracking-tight">Join game</h1>
        <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-snug text-muted">
          Enter the game code and your display name to join the live trivia!
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-10 flex flex-1 flex-col gap-5">
        <label className="block space-y-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-amber">
            Game code
          </span>
          <input
            className="w-full rounded-xl border bg-panel px-4 py-3.5 text-center font-bold uppercase tracking-[0.35em] text-amber outline-none"
            style={{
              borderColor: "var(--amber)",
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
          <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-amber">
            Display name
          </span>
          <input
            className="w-full rounded-xl border border-line bg-panel px-4 py-3.5 text-[17px] font-semibold text-chalk outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Your name"
            autoFocus={!!code}
          />
          <span className="block text-xs text-muted">
            Letters, numbers, and spaces — keep it friendly for the room.
          </span>
        </label>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button
          type="submit"
          className="mt-2 w-full rounded-xl py-4 text-base font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg, var(--amber-hot) 0%, var(--amber) 100%)",
            color: "#1a1200",
          }}
          disabled={checking}
        >
          {checking ? "Checking…" : "Continue"}
        </button>
      </form>

      <p className="relative z-10 mt-8 flex items-start justify-center gap-2 text-center text-xs leading-snug text-muted">
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-4 w-4 shrink-0 text-amber"
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
            "radial-gradient(ellipse 90% 80% at 50% 100%, color-mix(in srgb, var(--amber) 22%, transparent) 0%, transparent 70%)",
        }}
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-[140%] -translate-x-1/2 opacity-40"
        viewBox="0 0 400 120"
        fill="none"
      >
        <ellipse cx="200" cy="110" rx="170" ry="14" stroke="color-mix(in srgb, var(--amber) 50%, transparent)" strokeWidth="1.5" />
        <ellipse cx="200" cy="90" rx="130" ry="18" stroke="color-mix(in srgb, var(--amber) 30%, transparent)" strokeWidth="1" />
        <ellipse cx="200" cy="68" rx="90" ry="20" stroke="color-mix(in srgb, var(--amber) 18%, transparent)" strokeWidth="1" />
      </svg>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-ink p-10 text-muted">
          Loading…
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
