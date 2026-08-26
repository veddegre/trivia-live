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
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { GAME_TYPE_LABEL, type GameType } from "@/lib/types";

type AdminTab = "create" | "games" | "winners" | "hosts" | "admins" | "account";

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
  gameType?: GameType;
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

type AdminListItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
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

const ADMIN_TABS: AdminTab[] = [
  "create",
  "games",
  "winners",
  "hosts",
  "admins",
  "account",
];

function AdminInner() {
  const router = useRouter();
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const initialTab =
    tabParam && ADMIN_TABS.includes(tabParam as AdminTab)
      ? (tabParam as AdminTab)
      : "create";

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupTokenRequired, setSetupTokenRequired] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [results, setResults] = useState<GameResultItem[]>([]);
  const [hosts, setHosts] = useState<HostListItem[]>([]);
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [hostForm, setHostForm] = useState({
    id: null as string | null,
    name: "",
    email: "",
    password: "",
  });
  const [adminForm, setAdminForm] = useState({
    id: null as string | null,
    name: "",
    email: "",
    password: "",
  });
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
    password: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [gameType, setGameType] = useState<GameType>("TRIVIA");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    emptyQuestion("TRIVIA"),
  ]);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"good" | "bad">("good");

  const isSuper = user?.role === "SUPERADMIN";

  const goTab = useCallback(
    (next: AdminTab) => {
      if (
        (next === "hosts" || next === "admins") &&
        user?.role !== "SUPERADMIN"
      ) {
        return;
      }
      setTab((prev) => {
        if (prev !== next) {
          setMessage("");
          setMessageTone("good");
        }
        return next;
      });
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

  const loadAdmins = useCallback(async () => {
    const res = await fetch("/api/admin/admins");
    if (res.status === 401 || res.status === 403) return;
    const data = await res.json();
    setAdmins(data.admins || []);
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
        const data = await res.json().catch(() => ({}));
        if (data.needsSetup) {
          setNeedsSetup(true);
          setSetupTokenRequired(!!data.setupTokenRequired);
          setAuthed(false);
          setUser(null);
          // Prefer dedicated setup endpoint flags when available
          try {
            const setupRes = await fetch("/api/admin/setup", { cache: "no-store" });
            const setupData = await setupRes.json().catch(() => ({}));
            if (typeof setupData.setupTokenRequired === "boolean") {
              setSetupTokenRequired(setupData.setupTokenRequired);
            }
          } catch {
            /* ignore */
          }
          return;
        }
        setNeedsSetup(false);
        if (!res.ok) {
          setAuthed(false);
          setUser(null);
          return;
        }
        if (data.authenticated && data.user) {
          setUser(data.user);
          setAccountForm({
            name: data.user.name,
            email: data.user.email,
            currentPassword: "",
            password: "",
          });
          setAuthed(true);
          await Promise.all([loadGames(), loadResults()]);
          if (data.user.role === "SUPERADMIN") {
            await Promise.all([loadHosts(), loadAdmins()]);
          }
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
  }, [loadGames, loadResults, loadHosts, loadAdmins]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setGameType("TRIVIA");
    setQuestions([emptyQuestion("TRIVIA")]);
    setAllowLateJoin(true);
  }

  function chooseGameType(next: GameType) {
    if (next === gameType) return;
    const hasContent = questions.some(
      (q) =>
        (q.prompt.trim() && q.prompt.trim() !== "What is this?") ||
        q.imageKey ||
        q.options.some((o) => o.trim())
    );
    if (
      hasContent &&
      !confirm("Switching game type clears the current questions. Continue?")
    ) {
      return;
    }
    setGameType(next);
    setQuestions([emptyQuestion(next)]);
  }

  function resetHostForm() {
    setHostForm({ id: null, name: "", email: "", password: "" });
  }

  function resetAdminForm() {
    setAdminForm({ id: null, name: "", email: "", password: "" });
  }

  function showMessage(text: string, tone: "good" | "bad" = "good") {
    setMessageTone(tone);
    setMessage(text);
  }

  // Auto-clear flash messages so they don’t linger across the admin UI
  useEffect(() => {
    if (!message) return;
    const ms = messageTone === "bad" ? 8000 : 4000;
    const t = window.setTimeout(() => setMessage(""), ms);
    return () => window.clearTimeout(t);
  }, [message, messageTone]);

  async function completeSetup(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: setupName,
          email,
          password,
          ...(setupTokenRequired ? { setupToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(
          typeof data.error === "string" ? data.error : "Setup failed"
        );
        return;
      }
      setNeedsSetup(false);
      setUser(data.user);
      setAccountForm({
        name: data.user.name,
        email: data.user.email,
        currentPassword: "",
        password: "",
      });
      setAuthed(true);
      setPassword("");
      await Promise.all([loadGames(), loadResults(), loadHosts(), loadAdmins()]);
    } finally {
      setBusy(false);
    }
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
    if (data.needsSetup) {
      setNeedsSetup(true);
      setLoginError("Complete first-time setup first.");
      return;
    }
    if (!res.ok) {
      setLoginError(
        typeof data.error === "string" ? data.error : "Wrong email or password"
      );
      return;
    }
    setUser(data.user);
    setAccountForm({
      name: data.user.name,
      email: data.user.email,
      currentPassword: "",
      password: "",
    });
    setAuthed(true);
    setPassword("");
    await Promise.all([loadGames(), loadResults()]);
    if (data.user?.role === "SUPERADMIN") {
      await Promise.all([loadHosts(), loadAdmins()]);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
    setUser(null);
    setGames([]);
    setResults([]);
    setHosts([]);
    setAdmins([]);
    resetHostForm();
    resetAdminForm();
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
      const loadedType: GameType =
        g.gameType === "IMAGE_ZOOM" ? "IMAGE_ZOOM" : "TRIVIA";
      setGameType(loadedType);
      setQuestions(
        (g.questions || []).map(
          (q: {
            prompt: string;
            options: string[];
            correctIndex: number;
            timeLimitSec: number;
            basePoints: number;
            timeBonus: number;
            imageKey?: string | null;
            startZoom?: number;
          }) => ({
            prompt: q.prompt,
            options: Array.isArray(q.options) ? [...q.options] : ["", ""],
            correctIndex: q.correctIndex,
            timeLimitSec: q.timeLimitSec,
            basePoints: q.basePoints,
            timeBonus: q.timeBonus,
            imageKey: q.imageKey ?? null,
            startZoom: q.startZoom ?? 10,
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
        gameType,
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
      const wasEdit = !!editingId;
      resetForm();
      await Promise.all([loadGames(), loadResults()]);
      goTab("games");
      showMessage(
        wasEdit
          ? `Updated “${savedTitle}”`
          : `Created “${savedTitle}” — code ${code}`
      );
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

  async function saveAdmin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const editing = !!adminForm.id;
      const payload: { name: string; email: string; password?: string } = {
        name: adminForm.name.trim(),
        email: adminForm.email.trim(),
      };
      if (adminForm.password.trim()) payload.password = adminForm.password;
      if (!editing && !payload.password) {
        showMessage("Password is required for new admins", "bad");
        return;
      }

      const res = await fetch(
        editing ? `/api/admin/admins/${adminForm.id}` : "/api/admin/admins",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage(
          typeof data.error === "string" ? data.error : "Could not save admin",
          "bad"
        );
        return;
      }
      showMessage(editing ? `Updated ${payload.name}` : `Created admin ${payload.name}`);
      resetAdminForm();
      await loadAdmins();
      // If we edited ourselves, refresh header user
      if (editing && adminForm.id === user?.id && data.admin) {
        setUser((u) =>
          u
            ? {
                ...u,
                name: data.admin.name,
                email: data.admin.email,
              }
            : u
        );
        setAccountForm((a) => ({
          ...a,
          name: data.admin.name,
          email: data.admin.email,
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(id: string, name: string) {
    if (
      !confirm(
        `Delete super-admin “${name}”?\n\nTheir games will be reassigned to you.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showMessage(
        typeof data.error === "string" ? data.error : "Could not delete admin",
        "bad"
      );
      return;
    }
    if (data.deletedSelf) {
      await logout();
      return;
    }
    if (adminForm.id === id) resetAdminForm();
    showMessage(`Deleted admin ${name}`);
    await Promise.all([loadAdmins(), loadGames(), loadResults()]);
  }

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload: {
        name: string;
        email: string;
        password?: string;
        currentPassword?: string;
      } = {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
      };
      if (accountForm.password.trim()) {
        payload.password = accountForm.password;
        payload.currentPassword = accountForm.currentPassword;
      }
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage(
          typeof data.error === "string" ? data.error : "Could not update account",
          "bad"
        );
        return;
      }
      setUser(data.user);
      setAccountForm({
        name: data.user.name,
        email: data.user.email,
        currentPassword: "",
        password: "",
      });
      showMessage("Account updated");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    return questions.every((q) => {
      const opts = q.options.map((o) => o.trim()).filter(Boolean);
      const basics =
        q.prompt.trim() && opts.length >= 2 && q.correctIndex < opts.length;
      if (!basics) return false;
      if (gameType === "IMAGE_ZOOM" && !q.imageKey) return false;
      return true;
    });
  }, [title, questions, gameType]);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-5">
        <p className="text-muted">Checking session…</p>
      </main>
    );
  }

  if (!authed && needsSetup) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-ink px-5 py-10">
        <BrandMark badgeLast />
        <h1 className="mt-8 text-3xl font-bold text-chalk">Create admin</h1>
        <p className="mt-2 text-sm text-muted">
          First-time setup — choose your name, email, and password for the
          super-admin account.
        </p>
        <form
          onSubmit={completeSetup}
          className="mt-6 space-y-4 rounded-2xl border border-line bg-panel p-5"
        >
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Name
            </span>
            <input
              className="field"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              autoComplete="name"
              autoFocus
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
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
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>
          {setupTokenRequired && (
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                Setup token
              </span>
              <input
                type="password"
                className="field"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                autoComplete="off"
                required
                placeholder="From server SETUP_TOKEN"
              />
              <span className="block text-xs text-muted">
                Set in the server environment as SETUP_TOKEN, then enter it here.
              </span>
            </label>
          )}
          {loginError && <p className="text-sm text-bad">{loginError}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create super-admin"}
          </button>
        </form>
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
              <NavButton active={tab === "admins"} onClick={() => goTab("admins")}>
                Super-admins
              </NavButton>
            </>
          )}

          <div className="mt-5 px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            You
          </div>
          <NavButton active={tab === "account"} onClick={() => goTab("account")}>
            Account
          </NavButton>
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
                {gameType === "IMAGE_ZOOM"
                  ? "Upload photos that start zoomed in and slowly reveal as the timer runs down"
                  : "Build your Trivia Live game"}
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

                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                    Game type
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          id: "TRIVIA" as const,
                          title: "Trivia",
                          blurb: "Classic multiple-choice questions",
                        },
                        {
                          id: "IMAGE_ZOOM" as const,
                          title: "Image Zoom",
                          blurb: "A photo starts cropped in tight, then slowly opens",
                        },
                      ] as const
                    ).map((opt) => {
                      const on = gameType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => chooseGameType(opt.id)}
                          className="rounded-2xl border px-4 py-4 text-left transition"
                          style={
                            on
                              ? {
                                  borderColor: "var(--amber)",
                                  background:
                                    "color-mix(in srgb, var(--amber) 12%, var(--panel))",
                                }
                              : {
                                  borderColor: "var(--line)",
                                  background: "var(--panel)",
                                }
                          }
                        >
                          <div className="text-sm font-bold text-chalk">
                            {opt.title}
                          </div>
                          <div className="mt-1 text-xs text-muted">{opt.blurb}</div>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {questions.map((q, qi) => (
                  <QuestionEditor
                    key={qi}
                    question={q}
                    index={qi}
                    gameType={gameType}
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
                  onClick={() =>
                    setQuestions((prev) => [...prev, emptyQuestion(gameType)])
                  }
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
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xl font-bold">{g.title}</div>
                        {g.gameType === "IMAGE_ZOOM" && (
                          <span className="rounded bg-ink-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                            {GAME_TYPE_LABEL.IMAGE_ZOOM}
                          </span>
                        )}
                      </div>
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
                    minLength={hostForm.id ? undefined : MIN_PASSWORD_LENGTH}
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

          {tab === "admins" && isSuper && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">Super-admins</h1>
              <p className="mt-1 text-sm text-muted">
                People who can see all games and manage hosts. You can’t delete
                the last super-admin.
              </p>

              <form
                onSubmit={saveAdmin}
                className="mt-8 space-y-4 rounded-2xl border border-line bg-panel p-5"
              >
                <div className="text-sm font-bold text-chalk">
                  {adminForm.id ? "Edit admin" : "Add admin"}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                      Name
                    </span>
                    <input
                      className="field"
                      value={adminForm.name}
                      onChange={(e) =>
                        setAdminForm((a) => ({ ...a, name: e.target.value }))
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
                      value={adminForm.email}
                      onChange={(e) =>
                        setAdminForm((a) => ({ ...a, email: e.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                    {adminForm.id ? "New password (optional)" : "Password"}
                  </span>
                  <input
                    type="password"
                    className="field"
                    value={adminForm.password}
                    onChange={(e) =>
                      setAdminForm((a) => ({ ...a, password: e.target.value }))
                    }
                    minLength={adminForm.id ? undefined : MIN_PASSWORD_LENGTH}
                    required={!adminForm.id}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  {adminForm.id && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetAdminForm}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy
                      ? "Saving…"
                      : adminForm.id
                        ? "Update admin"
                        : "Add admin"}
                  </button>
                </div>
                {message && tab === "admins" && (
                  <p
                    className={`text-sm ${messageTone === "bad" ? "text-bad" : "text-good"}`}
                  >
                    {message}
                  </p>
                )}
              </form>

              <div className="mt-8 space-y-3">
                {admins.map((a) => (
                  <article
                    key={a.id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-xl font-bold">
                        {a.name}
                        {a.id === user?.id ? (
                          <span className="ml-2 text-sm font-semibold text-amber">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-muted">{a.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setAdminForm({
                            id: a.id,
                            name: a.name,
                            email: a.email,
                            password: "",
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => void removeAdmin(a.id, a.name)}
                        disabled={admins.length <= 1}
                        title={
                          admins.length <= 1
                            ? "Cannot delete the last super-admin"
                            : "Delete"
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "account" && (
            <section className="mx-auto max-w-4xl">
              <h1 className="text-3xl font-bold md:text-4xl">Account</h1>
              <p className="mt-1 text-sm text-muted">
                Update your name, email, or password.
              </p>
              <form
                onSubmit={saveAccount}
                className="mt-8 max-w-lg space-y-4 rounded-2xl border border-line bg-panel p-5"
              >
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                    Name
                  </span>
                  <input
                    className="field"
                    value={accountForm.name}
                    onChange={(e) =>
                      setAccountForm((a) => ({ ...a, name: e.target.value }))
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
                    value={accountForm.email}
                    onChange={(e) =>
                      setAccountForm((a) => ({ ...a, email: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                    Current password
                  </span>
                  <input
                    type="password"
                    className="field"
                    value={accountForm.currentPassword}
                    onChange={(e) =>
                      setAccountForm((a) => ({
                        ...a,
                        currentPassword: e.target.value,
                      }))
                    }
                    autoComplete="current-password"
                    placeholder="Only needed to change password"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
                    New password
                  </span>
                  <input
                    type="password"
                    className="field"
                    value={accountForm.password}
                    onChange={(e) =>
                      setAccountForm((a) => ({ ...a, password: e.target.value }))
                    }
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    placeholder="Leave blank to keep current"
                  />
                </label>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save account"}
                </button>
                {message && tab === "account" && (
                  <p
                    className={`text-sm ${messageTone === "bad" ? "text-bad" : "text-good"}`}
                  >
                    {message}
                  </p>
                )}
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
        <main className="flex min-h-screen items-center justify-center bg-ink px-5 text-muted">
          Loading…
        </main>
      }
    >
      <AdminInner />
    </Suspense>
  );
}
