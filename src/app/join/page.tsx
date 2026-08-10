"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import Link from "next/link";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    const q = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
    router.push(`/play/${c}${q}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
      <Link href="/" className="display text-2xl text-amber">
        Bar Trivia
      </Link>
      <h1 className="display anim-rise mt-10 text-4xl">Join game</h1>
      <p className="mt-2 text-muted">Enter the code on the host screen.</p>

      <form onSubmit={onSubmit} className="panel anim-rise mt-8 space-y-4 rounded-2xl p-5">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Game code</span>
          <input
            className="field display text-center text-2xl tracking-[0.3em] uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="ABC123"
            autoComplete="off"
            required
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Your name</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Alex"
          />
        </label>
        <button type="submit" className="btn btn-primary w-full">
          Continue
        </button>
      </form>
    </main>
  );
}
