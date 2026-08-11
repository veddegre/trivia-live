"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { BrandEditor, emptyBrandForm, type BrandFormState } from "@/components/BrandEditor";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import {
  emptyQuestion,
  QuestionEditor,
  type DraftQuestion,
} from "@/components/QuestionEditor";
import { buildTokens, tokensToCssVars, type BrandConfig } from "@/lib/branding";

type AdminTab = "create" | "games" | "winners" | "branding";

type GameListItem = {
  id: string;
  title: string;
  code: string;
  status: string;
  hostToken: string;
  allowLateJoin: boolean;
  _count: { questions: number; players: number };
};

type GameResultItem = {
  id: string;
  gameTitle: string;
  joinCode: string;
  winnerName: string;
  winnerScore: number;
  playerCount: number;
  podium: { name: string; totalScore: number }[] | null;
  finishedAt: string;
};

function formatFinishedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

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

function serializeQuestions(questions: DraftQuestion[]) {
  return questions.map((q) => ({
    ...q,
    options: q.options.map((o) => o.trim()).filter(Boolean),
  }));
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition"
      style={
        active
          ? {
              background: "#1a2338",
              color: "#ffffff",
              boxShadow: "inset 3px 0 0 #f8b62d",
            }
          : { color: "#c8cdd8" }
      }
    >
      {children}
    </button>
  );
}

const ADMIN_TABS: AdminTab[] = ["create", "games", "winners", "branding"];

function AdminInner() {
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const initialTab =
    tabParam && ADMIN_TABS.includes(tabParam as AdminTab)
      ? (tabParam as AdminTab)
      : "create";

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [results, setResults] = useState<GameResultItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
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

  const loadResults = useCallback(async () => {
    const res = await fetch("/api/games/results");
    if (res.status === 401) return;
    const data = await res.json();
    setResults(data.results || []);
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
    if (tabParam && ADMIN_TABS.includes(tabParam as AdminTab)) {
      setTab(tabParam as AdminTab);
    }
  }, [tabParam]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/login");
      const data = await res.json();
      if (data.authenticated) {
        setAuthed(true);
        await Promise.all([loadGames(), loadBrand(), loadResults()]);
      } else {
        setAuthed(false);
      }
    })();
  }, [loadGames, loadBrand, loadResults]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setQuestions([emptyQuestion()]);
    setAllowLateJoin(true);
    setCustomizeGame(false);
    setGameBrand(emptyBrandForm());
  }

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
    await Promise.all([loadGames(), loadBrand(), loadResults()]);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setGames([]);
    setResults([]);
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

  async function startEdit(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/games/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not load game");
        return;
      }
      const g = data.game;
      setEditingId(g.id);
      setTitle(g.title || "");
      setAllowLateJoin(g.allowLateJoin !== false);
      setQuestions(
        (g.questions || []).map(
          (q: {
            prompt: string;
            options: string[];
            correctIndex: number;
            timeLimitSec: number;
            basePoints: number;
            timeBonus: number;
          }) => ({
            prompt: q.prompt,
            options: [...q.options],
            correctIndex: q.correctIndex,
            timeLimitSec: q.timeLimitSec,
            basePoints: q.basePoints,
            timeBonus: q.timeBonus,
          })
        )
      );
      const hasBrand = !!(
        g.brandDisplayName ||
        g.brandTagline ||
        g.brandLogoUrl ||
        g.brandPreset ||
        g.brandMode ||
        g.brandAccent ||
        g.brandBackground
      );
      setCustomizeGame(hasBrand);
      setGameBrand({
        displayName: g.brandDisplayName || "",
        tagline: g.brandTagline || "",
        logoUrl: g.brandLogoUrl || "",
        preset: g.brandPreset || "default",
        mode: g.brandMode || "dark",
        accent: g.brandAccent || "",
        background: g.brandBackground || "",
      });
      setTab("create");
    } finally {
      setBusy(false);
    }
  }

  async function saveGame(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        title,
        allowLateJoin,
        questions: serializeQuestions(questions),
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

      const res = await fetch(editingId ? `/api/games/${editingId}` : "/api/games", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not save game");
        return;
      }
      const savedTitle = data.game?.title || title;
      const code = data.game?.code as string | undefined;
      setMessage(
        editingId
          ? `Updated “${savedTitle}”`
          : `Created “${savedTitle}” — code ${code}`
      );
      resetForm();
      await Promise.all([loadGames(), loadResults()]);
      setTab("games");
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
    if (editingId === id) resetForm();
    await loadGames();
  }

  async function recycleGame(id: string, gameTitle: string) {
    if (
      !confirm(
        `Reset “${gameTitle}”?\n\nThis clears players and scores, keeps the questions, and issues a new join code.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/games/${id}/reset`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Could not reset game");
      return;
    }
    const nextCode = data.game?.code as string | undefined;
    setMessage(
      nextCode
        ? `“${gameTitle}” reset — new code ${nextCode}. Click Host screen so the QR updates.`
        : `“${gameTitle}” reset — click Host screen so the QR updates.`
    );
    await loadGames();
  }

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    return questions.every((q) => {
      const opts = q.options.map((o) => o.trim()).filter(Boolean);
      return q.prompt.trim() && opts.length >= 2 && q.correctIndex < opts.length;
    });
  }, [title, questions]);

  const sitePreview = useMemo(() => previewConfig(siteBrand), [siteBrand]);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5" style={{ background: "#0b0e14" }}>
        <p style={{ color: "#9aa6c1" }}>Checking session…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main
        className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10"
        style={{ background: "#0b0e14" }}
      >
        <BrandMark badgeLast />
        <h1 className="mt-8 text-3xl font-bold text-white">Admin</h1>
        <form
          onSubmit={login}
          className="mt-6 space-y-4 rounded-2xl border p-5"
          style={{ borderColor: "#2a3550", background: "#121826" }}
        >
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "#f8b62d" }}>
              Password
            </span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </label>
          {loginError && <p className="text-sm text-bad">{loginError}</p>}
          <button className="btn btn-primary w-full" type="submit">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#0b0e14", color: "#ffffff" }}>
      {/* Sidebar */}
      <aside
        className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r px-3 py-5 md:w-64"
        style={{ borderColor: "#2a3550", background: "#0e1420" }}
      >
        <div className="px-1">
          <BrandMark href="/" size="sm" />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <div
            className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "#9aa6c1" }}
          >
            Games
          </div>
          <NavButton active={tab === "create"} onClick={() => setTab("create")}>
            Create game
          </NavButton>
          <NavButton active={tab === "games"} onClick={() => setTab("games")}>
            All games
          </NavButton>

          <div
            className="mt-5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "#9aa6c1" }}
          >
            History
          </div>
          <NavButton active={tab === "winners"} onClick={() => setTab("winners")}>
            Past winners
          </NavButton>

          <div
            className="mt-5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "#9aa6c1" }}
          >
            Settings
          </div>
          <NavButton active={tab === "branding"} onClick={() => setTab("branding")}>
            Branding
          </NavButton>
        </nav>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold"
          style={{ color: "#9aa6c1" }}
        >
          ← Log out
        </button>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-end border-b px-6 py-4"
          style={{ borderColor: "#2a3550" }}
        >
          <div
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
            style={{ borderColor: "#2a3550", background: "#121826" }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "#f8b62d", color: "#0b0e14" }}
            >
              A
            </span>
            Admin
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {tab === "create" && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">
                {editingId ? "Edit game" : "Create a game"}
              </h1>
              <p className="mt-1 text-sm" style={{ color: "#9aa6c1" }}>
                Build your Trivia Live game
              </p>

              <form onSubmit={saveGame} className="mt-8 space-y-5">
                <label className="block space-y-2">
                  <span
                    className="text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: "#f8b62d" }}
                  >
                    Game title
                  </span>
                  <input
                    className="field"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter game title…"
                    required
                  />
                </label>

                {questions.map((q, qi) => (
                  <QuestionEditor
                    key={qi}
                    question={q}
                    index={qi}
                    canRemove={questions.length > 1}
                    onChange={(next) =>
                      setQuestions((prev) =>
                        prev.map((item, i) => (i === qi ? next : item))
                      )
                    }
                    onRemove={() =>
                      setQuestions((prev) => prev.filter((_, i) => i !== qi))
                    }
                    allowLateJoin={allowLateJoin}
                    onAllowLateJoinChange={setAllowLateJoin}
                  />
                ))}

                <div
                  className="rounded-2xl border p-4"
                  style={{ borderColor: "#2a3550", background: "#121826" }}
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="accent-[#f8b62d]"
                      checked={customizeGame}
                      onChange={(e) => setCustomizeGame(e.target.checked)}
                    />
                    <span className="text-sm font-semibold">Customize this game’s look</span>
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

                <button
                  type="button"
                  className="w-full rounded-xl border border-dashed py-3.5 text-sm font-bold"
                  style={{ borderColor: "rgba(248,182,45,0.5)", color: "#f8b62d" }}
                  onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
                >
                  + Add question
                </button>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  {editingId && (
                    <button
                      type="button"
                      className="rounded-md border px-5 py-2.5 text-sm font-bold"
                      style={{ borderColor: "#2a3550", color: "#ffffff" }}
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canSubmit || busy}
                  >
                    {busy ? "Saving…" : editingId ? "Update game" : "Save game"}
                  </button>
                </div>
                {message && <p className="text-sm text-good">{message}</p>}
              </form>
            </section>
          )}

          {tab === "games" && (
            <section className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold md:text-4xl">All games</h1>
                  <p className="mt-1 text-sm" style={{ color: "#9aa6c1" }}>
                    Open a lobby, host a night, or edit questions
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    resetForm();
                    setTab("create");
                  }}
                >
                  + New game
                </button>
              </div>
              {message && <p className="mt-4 text-sm text-good">{message}</p>}
              <div className="mt-6 space-y-3">
                {games.length === 0 && (
                  <p style={{ color: "#9aa6c1" }}>No games yet — create one.</p>
                )}
                {games.map((g) => (
                  <article
                    key={g.id}
                    className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                    style={{ borderColor: "#2a3550", background: "#121826" }}
                  >
                    <div>
                      <div className="text-xl font-bold">{g.title}</div>
                      <div className="mt-1 text-sm" style={{ color: "#9aa6c1" }}>
                        Code <span style={{ color: "#f8b62d" }}>{g.code}</span> ·{" "}
                        {g._count.questions} questions · {g._count.players} players ·{" "}
                        {g.status}
                        {g.allowLateJoin === false ? " · no late joins" : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-ghost"
                        onClick={() => void startEdit(g.id)}
                        disabled={
                          g.status === "QUESTION" ||
                          g.status === "REVEAL" ||
                          g.status === "BETWEEN"
                        }
                      >
                        Edit
                      </button>
                      {g.status === "DRAFT" && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => void openLobby(g.id)}
                        >
                          Open lobby
                        </button>
                      )}
                      {g.status !== "DRAFT" && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => void recycleGame(g.id, g.title)}
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
                      <button
                        className="btn btn-danger"
                        onClick={() => void removeGame(g.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "winners" && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">Past winners</h1>
              <p className="mt-1 text-sm" style={{ color: "#9aa6c1" }}>
                Saved when a night finishes — kept after Play again.
              </p>
              <div className="mt-6 space-y-3">
                {results.length === 0 && (
                  <p style={{ color: "#9aa6c1" }}>No finished games yet.</p>
                )}
                {results.map((r) => (
                  <article
                    key={r.id}
                    className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: "#2a3550", background: "#121826" }}
                  >
                    <div>
                      <div className="text-xl font-bold" style={{ color: "#f8b62d" }}>
                        {r.winnerName}
                      </div>
                      <div className="mt-1 text-sm" style={{ color: "#9aa6c1" }}>
                        {r.gameTitle} · {r.winnerScore} pts · {r.playerCount} players · code{" "}
                        {r.joinCode}
                      </div>
                      {Array.isArray(r.podium) && r.podium.length > 1 && (
                        <div className="mt-1 text-xs" style={{ color: "#9aa6c1" }}>
                          Podium:{" "}
                          {r.podium
                            .map((p, i) => `${i + 1}. ${p.name} (${p.totalScore})`)
                            .join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm tabular-nums" style={{ color: "#9aa6c1" }}>
                      {formatFinishedAt(r.finishedAt)}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "branding" && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">Branding</h1>
              <p className="mt-1 text-sm" style={{ color: "#9aa6c1" }}>
                Defaults for every screen. Games can override these when created.
              </p>
              <form
                onSubmit={saveSiteBrand}
                className="mt-8 space-y-5 rounded-2xl border p-5 md:p-6"
                style={{ borderColor: "#2a3550", background: "#121826" }}
              >
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
                      <p className="mt-2 text-muted">
                        Accent and surfaces update with your choices.
                      </p>
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
                  {brandMsg && <p className="text-sm text-good">{brandMsg}</p>}
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center px-5"
          style={{ background: "#0b0e14", color: "#9aa6c1" }}
        >
          Loading…
        </main>
      }
    >
      <AdminInner />
    </Suspense>
  );
}
