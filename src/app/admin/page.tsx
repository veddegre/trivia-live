"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BrandMark } from "@/components/BrandMark";
import {
  emptyQuestion,
  QuestionEditor,
  type DraftQuestion,
} from "@/components/QuestionEditor";

type AdminTab = "create" | "games" | "winners" | "hosts";

const LIVE_STATUSES = new Set(["QUESTION", "REVEAL", "BETWEEN"]);

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "HOST" | "SUPERADMIN";
};

type GameListItem = {
  id: string;
  title: string;
  code: string;
  status: string;
  hostToken: string;
  allowLateJoin: boolean;
  owner?: { id: string; name: string; email: string } | null;
  _count: { questions: number; players: number };
};

type HostListItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  _count: { games: number };
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
  owner?: { id: string; name: string; email: string } | null;
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
              background: "var(--ink-2)",
              color: "var(--chalk)",
              boxShadow: "inset 3px 0 0 var(--amber)",
            }
          : { color: "var(--muted)" }
      }
    >
      {children}
    </button>
  );
}

const ADMIN_TABS: AdminTab[] = ["create", "games", "winners", "hosts"];

function AdminInner() {
  const router = useRouter();
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const initialTab =
    tabParam && ADMIN_TABS.includes(tabParam as AdminTab)
      ? (tabParam as AdminTab)
      : "create";

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [results, setResults] = useState<GameResultItem[]>([]);
  const [hosts, setHosts] = useState<HostListItem[]>([]);
  const [hostForm, setHostForm] = useState({
    id: null as string | null,
    name: "",
    email: "",
    password: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"good" | "bad">("good");

  const isSuper = user?.role === "SUPERADMIN";

  const goTab = useCallback(
    (next: AdminTab) => {
      if (next === "hosts" && user?.role !== "SUPERADMIN") return;
      setTab(next);
      const params = new URLSearchParams(search.toString());
      if (next === "create") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
    },
    [router, search, user?.role]
  );

  const loadGames = useCallback(async () => {
    const res = await fetch("/api/games");
    if (res.status === 401) {
      setAuthed(false);
      setUser(null);
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

  const loadHosts = useCallback(async () => {
    const res = await fetch("/api/admin/hosts");
    if (res.status === 401 || res.status === 403) return;
    const data = await res.json();
    setHosts(data.hosts || []);
  }, []);

  useEffect(() => {
    if (tabParam && ADMIN_TABS.includes(tabParam as AdminTab)) {
      setTab(tabParam as AdminTab);
    } else if (!tabParam) {
      setTab("create");
    }
  }, [tabParam]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/login", { cache: "no-store" });
        if (!res.ok) {
          setAuthed(false);
          setUser(null);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data.authenticated && data.user) {
          setUser(data.user);
          setAuthed(true);
          await Promise.all([loadGames(), loadResults()]);
          if (data.user.role === "SUPERADMIN") await loadHosts();
        } else {
          setAuthed(false);
          setUser(null);
        }
      } catch (err) {
        console.error("session check failed", err);
        setAuthed(false);
        setUser(null);
        setLoginError("Could not reach the server. Try refreshing.");
      }
    })();
  }, [loadGames, loadResults, loadHosts]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setQuestions([emptyQuestion()]);
    setAllowLateJoin(true);
  }

  function resetHostForm() {
    setHostForm({ id: null, name: "", email: "", password: "" });
  }

  function showMessage(text: string, tone: "good" | "bad" = "good") {
    setMessageTone(tone);
    setMessage(text);
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoginError(
        typeof data.error === "string" ? data.error : "Wrong email or password"
      );
      return;
    }
    setUser(data.user);
    setAuthed(true);
    setPassword("");
    await Promise.all([loadGames(), loadResults()]);
    if (data.user?.role === "SUPERADMIN") await loadHosts();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setUser(null);
    setGames([]);
    setResults([]);
    setHosts([]);
    resetHostForm();
  }



  async function startEdit(id: string) {
    const listed = games.find((g) => g.id === id);
    if (listed && LIVE_STATUSES.has(listed.status)) {
      showMessage(
        "Can’t edit while a round is in progress. Finish on the host screen, or use Play again first.",
        "bad"
      );
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/games/${id}`);
      const data = await res.json();
      if (!res.ok) {
        showMessage(
          typeof data.error === "string" ? data.error : "Could not load game",
          "bad"
        );
        return;
      }
      const g = data.game;
      if (LIVE_STATUSES.has(g.status)) {
        showMessage(
          "Can’t edit while a round is in progress. Finish on the host screen, or use Play again first.",
          "bad"
        );
        return;
      }
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
            options: Array.isArray(q.options) ? [...q.options] : ["", ""],
            correctIndex: q.correctIndex,
            timeLimitSec: q.timeLimitSec,
            basePoints: q.basePoints,
            timeBonus: q.timeBonus,
          })
        )
      );
      goTab("create");
    } finally {
      setBusy(false);
    }
  }

  async function saveGame(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        title,
        allowLateJoin,
        questions: serializeQuestions(questions),
      };

      const res = await fetch(editingId ? `/api/games/${editingId}` : "/api/games", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(
          typeof data.error === "string" ? data.error : "Could not save game",
          "bad"
        );
        return;
      }
      const savedTitle = data.game?.title || title;
      const code = data.game?.code as string | undefined;
      showMessage(
        editingId
          ? `Updated “${savedTitle}”`
          : `Created “${savedTitle}” — code ${code}`
      );
      resetForm();
      await Promise.all([loadGames(), loadResults()]);
      goTab("games");
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
      showMessage(
        typeof data.error === "string" ? data.error : "Could not reset game",
        "bad"
      );
      return;
    }
    const nextCode = data.game?.code as string | undefined;
    showMessage(
      nextCode
        ? `“${gameTitle}” reset — new code ${nextCode}. Click Host screen so the QR updates.`
        : `“${gameTitle}” reset — click Host screen so the QR updates.`
    );
    await loadGames();
  }

  async function saveHost(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const editing = !!hostForm.id;
      const payload: { name: string; email: string; password?: string } = {
        name: hostForm.name.trim(),
        email: hostForm.email.trim(),
      };
      if (hostForm.password.trim()) payload.password = hostForm.password;
      if (!editing && !payload.password) {
        showMessage("Password is required for new hosts", "bad");
        return;
      }

      const res = await fetch(
        editing ? `/api/admin/hosts/${hostForm.id}` : "/api/admin/hosts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage(
          typeof data.error === "string" ? data.error : "Could not save host",
          "bad"
        );
        return;
      }
      showMessage(editing ? `Updated ${payload.name}` : `Created host ${payload.name}`);
      resetHostForm();
      await loadHosts();
    } finally {
      setBusy(false);
    }
  }

  async function removeHost(id: string, name: string) {
    if (
      !confirm(
        `Delete host “${name}”?\n\nTheir games will be reassigned to you.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/hosts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showMessage(
        typeof data.error === "string" ? data.error : "Could not delete host",
        "bad"
      );
      return;
    }
    if (hostForm.id === id) resetHostForm();
    showMessage(`Deleted host ${name}`);
    await Promise.all([loadHosts(), loadGames(), loadResults()]);
  }

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    return questions.every((q) => {
      const opts = q.options.map((o) => o.trim()).filter(Boolean);
      return q.prompt.trim() && opts.length >= 2 && q.correctIndex < opts.length;
    });
  }, [title, questions]);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-5">
        <p className="text-muted">Checking session…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-ink px-5 py-10">
        <BrandMark badgeLast />
        <h1 className="mt-8 text-3xl font-bold text-chalk">Admin</h1>
        <form
          onSubmit={login}
          className="mt-6 space-y-4 rounded-2xl border border-line bg-panel p-5"
        >
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Email
            </span>
            <input
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Password
            </span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
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
    <div className="flex min-h-screen bg-ink text-chalk">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-5 md:w-64">
        <div className="px-1">
          <BrandMark href="/" size="sm" />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            Games
          </div>
          <NavButton active={tab === "create"} onClick={() => goTab("create")}>
            Create game
          </NavButton>
          <NavButton active={tab === "games"} onClick={() => goTab("games")}>
            {isSuper ? "All games" : "My games"}
          </NavButton>

          <div className="mt-5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            History
          </div>
          <NavButton active={tab === "winners"} onClick={() => goTab("winners")}>
            Past winners
          </NavButton>

          {isSuper && (
            <>
              <div className="mt-5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                Access
              </div>
              <NavButton active={tab === "hosts"} onClick={() => goTab("hosts")}>
                Hosts
              </NavButton>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-muted"
        >
          ← Log out
        </button>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-line px-6 py-4">
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-semibold">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--amber)", color: "#1a1200" }}
            >
              {(user?.name || "A").slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[10rem] truncate">{user?.name || "Admin"}</span>
            {isSuper && (
              <span className="rounded bg-ink-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber">
                Super
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {tab === "create" && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">
                {editingId ? "Edit game" : "Create a game"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Build your Trivia Live game
              </p>

              <form onSubmit={saveGame} className="mt-8 space-y-5">
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
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

                <button
                  type="button"
                  className="w-full rounded-xl border border-dashed py-3.5 text-sm font-bold"
                  style={{
                    borderColor: "color-mix(in srgb, var(--amber) 50%, var(--line))",
                    color: "var(--amber)",
                  }}
                  onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
                >
                  + Add question
                </button>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  {editingId && (
                    <button
                      type="button"
                      className="rounded-md border px-5 py-2.5 text-sm font-bold"
                      style={{ borderColor: "var(--line)", color: "var(--chalk)" }}
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
                {message && (
                  <p className={`text-sm ${messageTone === "bad" ? "text-bad" : "text-good"}`}>
                    {message}
                  </p>
                )}
              </form>
            </section>
          )}

          {tab === "games" && (
            <section className="mx-auto max-w-4xl">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold md:text-4xl">
                    {isSuper ? "All games" : "My games"}
                  </h1>
                  <p className="mt-1 text-sm text-muted">
                    Open a lobby, host a night, or edit questions
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    resetForm();
                    goTab("create");
                  }}
                >
                  + New game
                </button>
              </div>
              {message && (
                <p
                  className={`mt-4 text-sm ${messageTone === "bad" ? "text-bad" : "text-good"}`}
                >
                  {message}
                </p>
              )}
              <div className="mt-6 space-y-3">
                {games.length === 0 && (
                  <p className="text-muted">No games yet — create one.</p>
                )}
                {games.map((g) => (
                  <article
                    key={g.id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-xl font-bold">{g.title}</div>
                      <div className="mt-1 text-sm text-muted">
                        Code <span className="text-amber">{g.code}</span> ·{" "}
                        {g._count.questions} questions · {g._count.players} players ·{" "}
                        {g.status}
                        {g.allowLateJoin === false ? " · no late joins" : ""}
                        {isSuper && g.owner
                          ? ` · ${g.owner.name}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-ghost"
                        onClick={() => void startEdit(g.id)}
                        title={
                          LIVE_STATUSES.has(g.status)
                            ? "Finish the round or use Play again before editing"
                            : "Edit game"
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
              <p className="mt-1 text-sm text-muted">
                Saved when a night finishes — kept after Play again.
              </p>
              <div className="mt-6 space-y-3">
                {results.length === 0 && (
                  <p className="text-muted">No finished games yet.</p>
                )}
                {results.map((r) => (
                  <article
                    key={r.id}
                    className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-xl font-bold text-amber">
                        {r.winnerName}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {r.gameTitle} · {r.winnerScore} pts · {r.playerCount} players · code{" "}
                        {r.joinCode}
                        {isSuper && r.owner ? ` · ${r.owner.name}` : ""}
                      </div>
                      {Array.isArray(r.podium) && r.podium.length > 1 && (
                        <div className="mt-1 text-xs text-muted">
                          Podium:{" "}
                          {r.podium
                            .map((p, i) => `${i + 1}. ${p.name} (${p.totalScore})`)
                            .join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm tabular-nums text-muted">
                      {formatFinishedAt(r.finishedAt)}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "hosts" && isSuper && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">Hosts</h1>
              <p className="mt-1 text-sm text-muted">
                Create accounts for people who run their own games.
              </p>

              <form
                onSubmit={saveHost}
                className="mt-8 space-y-4 rounded-2xl border border-line bg-panel p-5"
              >
                <div className="text-sm font-bold text-chalk">
                  {hostForm.id ? "Edit host" : "Add host"}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                      Name
                    </span>
                    <input
                      className="field"
                      value={hostForm.name}
                      onChange={(e) =>
                        setHostForm((h) => ({ ...h, name: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                      Email
                    </span>
                    <input
                      type="email"
                      className="field"
                      value={hostForm.email}
                      onChange={(e) =>
                        setHostForm((h) => ({ ...h, email: e.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                    {hostForm.id ? "New password (optional)" : "Password"}
                  </span>
                  <input
                    type="password"
                    className="field"
                    value={hostForm.password}
                    onChange={(e) =>
                      setHostForm((h) => ({ ...h, password: e.target.value }))
                    }
                    minLength={hostForm.id ? undefined : 6}
                    required={!hostForm.id}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  {hostForm.id && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetHostForm}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? "Saving…" : hostForm.id ? "Update host" : "Add host"}
                  </button>
                </div>
                {message && tab === "hosts" && (
                  <p className={`text-sm ${messageTone === "bad" ? "text-bad" : "text-good"}`}>
                    {message}
                  </p>
                )}
              </form>

              <div className="mt-8 space-y-3">
                {hosts.length === 0 && (
                  <p className="text-muted">No hosts yet — add one above.</p>
                )}
                {hosts.map((h) => (
                  <article
                    key={h.id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-xl font-bold">{h.name}</div>
                      <div className="mt-1 text-sm text-muted">
                        {h.email} · {h._count.games} games
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setHostForm({
                            id: h.id,
                            name: h.name,
                            email: h.email,
                            password: "",
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => void removeHost(h.id, h.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
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
        <main className="flex min-h-screen items-center justify-center bg-ink px-5 text-muted">
          Loading…
        </main>
      }
    >
      <AdminInner />
    </Suspense>
  );
}
