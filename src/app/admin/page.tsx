"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type GameListItem = {
  id: string;
  title: string;
  code: string;
  status: string;
  hostToken: string;
  _count: { questions: number; players: number };
};

type DraftQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
};

const emptyQuestion = (): DraftQuestion => ({
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  timeLimitSec: 30,
});

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [games, setGames] = useState<GameListItem[]>([]);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadGames = useCallback(async () => {
    const res = await fetch("/api/games");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setGames(data.games || []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/login");
      const data = await res.json();
      if (data.authenticated) {
        setAuthed(true);
        await loadGames();
      } else {
        setAuthed(false);
      }
    })();
  }, [loadGames]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setLoginError("Wrong password");
      return;
    }
    setAuthed(true);
    await loadGames();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setGames([]);
  }

  async function createGame(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        title,
        questions: questions.map((q) => ({
          ...q,
          options: q.options.map((o) => o.trim()).filter(Boolean),
        })),
      };
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not create game");
        return;
      }
      setTitle("");
      setQuestions([emptyQuestion()]);
      setMessage(`Created “${data.game.title}” — code ${data.game.code}`);
      await loadGames();
    } finally {
      setBusy(false);
    }
  }

  async function openLobby(id: string) {
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LOBBY" }),
    });
    await loadGames();
  }

  async function removeGame(id: string) {
    if (!confirm("Delete this game?")) return;
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    await loadGames();
  }

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    return questions.every(
      (q) =>
        q.prompt.trim() &&
        q.options.filter((o) => o.trim()).length >= 2 &&
        q.correctIndex < q.options.filter((o) => o.trim()).length
    );
  }, [title, questions]);

  if (authed === null) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-muted">Checking session…</main>
    );
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
        <Link href="/" className="display text-2xl text-amber">
          Bar Trivia
        </Link>
        <h1 className="display mt-10 text-4xl">Admin</h1>
        <form onSubmit={login} className="panel mt-8 space-y-4 rounded-2xl p-5">
          <label className="block space-y-2">
            <span className="text-sm text-muted">Password</span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </label>
          {loginError && <p className="text-bad text-sm">{loginError}</p>}
          <button className="btn btn-primary w-full" type="submit">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="display text-2xl text-amber">
            Bar Trivia
          </Link>
          <h1 className="display mt-2 text-4xl">Game builder</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => void logout()}>
          Log out
        </button>
      </header>

      <section className="panel anim-rise mt-8 rounded-2xl p-5 md:p-6">
        <h2 className="display text-2xl">Create a game</h2>
        <form onSubmit={createGame} className="mt-5 space-y-5">
          <label className="block space-y-2">
            <span className="text-sm text-muted">Title</span>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thursday Pub Quiz"
              required
            />
          </label>

          {questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-line bg-ink-2/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm uppercase tracking-wider text-muted">
                  Question {qi + 1}
                </div>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="text-sm text-bad"
                    onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                className="field mt-3"
                placeholder="Question prompt"
                value={q.prompt}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) => (i === qi ? { ...item, prompt: e.target.value } : item))
                  )
                }
              />
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() =>
                        setQuestions((prev) =>
                          prev.map((item, i) =>
                            i === qi ? { ...item, correctIndex: oi } : item
                          )
                        )
                      }
                    />
                    <input
                      className="field"
                      placeholder={`Option ${oi + 1}`}
                      value={opt}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, i) => {
                            if (i !== qi) return item;
                            const options = [...item.options];
                            options[oi] = e.target.value;
                            return { ...item, options };
                          })
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-3 text-sm text-muted">
                Time limit (sec)
                <input
                  type="number"
                  min={5}
                  max={300}
                  className="field w-24"
                  value={q.timeLimitSec}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, i) =>
                        i === qi
                          ? { ...item, timeLimitSec: Number(e.target.value) || 30 }
                          : item
                      )
                    )
                  }
                />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            >
              Add question
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit || busy}>
              {busy ? "Saving…" : "Save game"}
            </button>
          </div>
          {message && <p className="text-good text-sm">{message}</p>}
        </form>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">Your games</h2>
        <div className="mt-4 space-y-3">
          {games.length === 0 && (
            <p className="text-muted">No games yet — create one above.</p>
          )}
          {games.map((g) => (
            <article
              key={g.id}
              className="panel flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="display text-xl">{g.title}</div>
                <div className="mt-1 text-sm text-muted">
                  Code <span className="text-amber">{g.code}</span> · {g._count.questions}{" "}
                  questions · {g._count.players} players · {g.status}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.status === "DRAFT" && (
                  <button className="btn btn-ghost" onClick={() => void openLobby(g.id)}>
                    Open lobby
                  </button>
                )}
                <Link
                  className="btn btn-primary"
                  href={`/host/${g.code}?token=${encodeURIComponent(g.hostToken)}`}
                  target="_blank"
                >
                  Host screen
                </Link>
                <button className="btn btn-danger" onClick={() => void removeGame(g.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
