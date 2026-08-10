"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { BrandEditor, emptyBrandForm, type BrandFormState } from "@/components/BrandEditor";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import { buildTokens, tokensToCssVars, type BrandConfig } from "@/lib/branding";

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

function previewConfig(form: BrandFormState): BrandConfig {
  return {
    displayName: form.displayName.trim() || "Trivia Live",
    tagline: form.tagline.trim() || null,
    logoUrl: form.logoUrl.trim() || null,
    preset: form.preset,
    mode: form.mode,
    accent: form.accent.trim() || null,
    background: form.background.trim() || null,
    tokens: buildTokens(
      form.preset,
      form.mode,
      form.accent.trim() || null,
      form.background.trim() || null
    ),
  };
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [games, setGames] = useState<GameListItem[]>([]);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [siteBrand, setSiteBrand] = useState<BrandFormState>(() => ({
    ...emptyBrandForm(),
    displayName: "Trivia Live",
  }));
  const [brandMsg, setBrandMsg] = useState("");
  const [brandBusy, setBrandBusy] = useState(false);
  const [customizeGame, setCustomizeGame] = useState(false);
  const [gameBrand, setGameBrand] = useState<BrandFormState>(emptyBrandForm);

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

  const loadBrand = useCallback(async () => {
    const res = await fetch("/api/branding");
    if (!res.ok) return;
    const data = await res.json();
    const s = data.site;
    if (!s) return;
    setSiteBrand({
      displayName: s.displayName || "Trivia Live",
      tagline: s.tagline || "",
      logoUrl: s.logoUrl || "",
      preset: s.preset || "default",
      mode: s.mode || "dark",
      accent: s.accent || "",
      background: s.background || "",
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/login");
      const data = await res.json();
      if (data.authenticated) {
        setAuthed(true);
        await Promise.all([loadGames(), loadBrand()]);
      } else {
        setAuthed(false);
      }
    })();
  }, [loadGames, loadBrand]);

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
    await Promise.all([loadGames(), loadBrand()]);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setGames([]);
  }

  async function uploadLogo(file: File): Promise<string | null> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/branding/logo", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setBrandMsg(data.error || "Upload failed");
      return null;
    }
    return data.url as string;
  }

  async function saveSiteBrand(e: FormEvent) {
    e.preventDefault();
    setBrandBusy(true);
    setBrandMsg("");
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: siteBrand.displayName,
          tagline: siteBrand.tagline || null,
          logoUrl: siteBrand.logoUrl || null,
          preset: siteBrand.preset,
          mode: siteBrand.mode,
          accent: siteBrand.accent || null,
          background: siteBrand.background || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBrandMsg(typeof data.error === "string" ? data.error : "Could not save branding");
        return;
      }
      setBrandMsg("Branding saved");
      if (data.site) {
        setSiteBrand({
          displayName: data.site.displayName,
          tagline: data.site.tagline || "",
          logoUrl: data.site.logoUrl || "",
          preset: data.site.preset,
          mode: data.site.mode,
          accent: data.site.accent || "",
          background: data.site.background || "",
        });
      }
    } finally {
      setBrandBusy(false);
    }
  }

  async function createGame(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        title,
        questions: questions.map((q) => ({
          ...q,
          options: q.options.map((o) => o.trim()).filter(Boolean),
        })),
        customize: customizeGame,
      };
      if (customizeGame) {
        Object.assign(payload, {
          brandDisplayName: gameBrand.displayName || null,
          brandTagline: gameBrand.tagline || null,
          brandLogoUrl: gameBrand.logoUrl || null,
          brandPreset: gameBrand.preset,
          brandMode: gameBrand.mode,
          brandAccent: gameBrand.accent || null,
          brandBackground: gameBrand.background || null,
        });
      }
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
      setCustomizeGame(false);
      setGameBrand(emptyBrandForm());
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

  async function recycleGame(id: string, title: string) {
    if (
      !confirm(
        `Reset “${title}”?\n\nThis clears all players and scores so you can play again with the same questions and join code.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/games/${id}/reset`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(typeof data.error === "string" ? data.error : "Could not reset game");
      return;
    }
    setMessage(`“${title}” reset — lobby open, ready for new players.`);
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

  const sitePreview = useMemo(() => previewConfig(siteBrand), [siteBrand]);

  if (authed === null) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-muted">Checking session…</main>
    );
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
        <BrandMark />
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
          <BrandMark />
          <h1 className="display mt-2 text-4xl">Game builder</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => void logout()}>
          Log out
        </button>
      </header>

      <section className="panel anim-rise mt-8 rounded-2xl p-5 md:p-6">
        <h2 className="display text-2xl">Site branding</h2>
        <p className="mt-1 text-sm text-muted">
          Defaults for every screen. Games can override these when created.
        </p>
        <form onSubmit={saveSiteBrand} className="mt-5 space-y-5">
          <BrandEditor
            value={siteBrand}
            onChange={setSiteBrand}
            onUpload={uploadLogo}
            idPrefix="site"
          />
          <BrandProvider
            brand={sitePreview}
            applyToDocument={false}
            className="rounded-xl border border-line p-4"
          >
            <div
              className="rounded-lg p-4"
              style={
                {
                  ...tokensToCssVars(sitePreview.tokens),
                  background: sitePreview.tokens.ink,
                  color: sitePreview.tokens.chalk,
                } as CSSProperties
              }
            >
              <div className="text-sm uppercase tracking-wider text-muted">Preview</div>
              <div className="mt-2">
                <BrandMark href={null} size="lg" />
              </div>
              {sitePreview.tagline ? (
                <p className="mt-2 text-muted">{sitePreview.tagline}</p>
              ) : (
                <p className="mt-2 text-muted">Accent and surfaces update with your choices.</p>
              )}
              <button type="button" className="btn btn-primary mt-4">
                Sample button
              </button>
            </div>
          </BrandProvider>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={brandBusy}>
              {brandBusy ? "Saving…" : "Save branding"}
            </button>
            {brandMsg && <p className="text-good text-sm">{brandMsg}</p>}
          </div>
        </form>
      </section>

      <section className="panel anim-rise mt-8 rounded-2xl p-5 md:p-6">
        <h2 className="display text-2xl">Create a game</h2>
        <form onSubmit={createGame} className="mt-5 space-y-5">
          <label className="block space-y-2">
            <span className="text-sm text-muted">Title</span>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday Team Trivia"
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
              <div className="mt-3 space-y-2">
                <div className="text-sm text-muted">Countdown timer (seconds)</div>
                <div className="flex flex-wrap items-center gap-2">
                  {[15, 20, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className={`btn text-sm ${
                        q.timeLimitSec === sec ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() =>
                        setQuestions((prev) =>
                          prev.map((item, i) =>
                            i === qi ? { ...item, timeLimitSec: sec } : item
                          )
                        )
                      }
                    >
                      {sec}s
                    </button>
                  ))}
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
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-line bg-ink-2/40 p-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={customizeGame}
                onChange={(e) => setCustomizeGame(e.target.checked)}
              />
              <span className="text-sm">Customize this game’s look</span>
            </label>
            {customizeGame && (
              <div className="mt-4">
                <BrandEditor
                  value={gameBrand}
                  onChange={setGameBrand}
                  overrideMode
                  onUpload={uploadLogo}
                  idPrefix="game"
                />
              </div>
            )}
          </div>

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
                {g.status !== "DRAFT" && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => void recycleGame(g.id, g.title)}
                    title="Clear players and scores; keep questions and code"
                  >
                    Play again
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
