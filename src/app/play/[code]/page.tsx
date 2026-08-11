"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useQuestionCountdown } from "@/hooks/useQuestionCountdown";
import type { BrandConfig } from "@/lib/branding";
import { getSocket } from "@/lib/socket-client";
import type { GamePublicState, PlayerView } from "@/lib/types";
import { DISPLAY_NAME_KEY } from "@/lib/types";

const storageKey = (code: string) => `trivia-player:${code}`;

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function PlayInner({ code }: { code: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const presetName = search.get("name") || "";
  const [name, setName] = useState(presetName);
  const [player, setPlayer] = useState<PlayerView | null>(null);
  const [state, setState] = useState<GamePublicState | null>(null);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gameMissing, setGameMissing] = useState(false);
  const autoJoinAttempted = useRef(false);

  const remaining = useQuestionCountdown(
    state?.questionOpenedAt,
    state?.timeLimitSec,
    state?.phase === "question"
  );

  const timeUp = remaining === 0;
  const locked =
    !!player?.hasAnswered || timeUp || state?.phase !== "question" || submitting;

  useEffect(() => {
    if (presetName) return;
    try {
      const saved = localStorage.getItem(DISPLAY_NAME_KEY);
      if (saved) setName(saved);
    } catch {
      /* ignore */
    }
  }, [presetName]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/games/by-code/${encodeURIComponent(code)}`);
        if (!res.ok) {
          if (!cancelled) {
            setGameMissing(true);
            setError(
              "Game not found — that join code isn’t active. Scan the current QR on the host screen."
            );
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setGameMissing(false);
        if (data.brand) setBrand(data.brand as BrandConfig);
        if (
          data.game?.allowLateJoin === false &&
          data.game?.status !== "LOBBY" &&
          data.game?.status !== "DRAFT"
        ) {
          setError("This game isn’t accepting late joins.");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (state?.brand) setBrand(state.brand);
  }, [state?.brand]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(code));
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { token: string };
      const socket = getSocket();
      const reconnect = () => {
        socket.emit(
          "player:reconnect",
          { code, token: saved.token },
          (res: {
            ok?: boolean;
            player?: PlayerView;
            state?: GamePublicState;
          }) => {
            if (!res?.ok) {
              localStorage.removeItem(storageKey(code));
              return;
            }
            if (res.player) setPlayer(res.player);
            if (res.state) setState(res.state);
          }
        );
      };
      const onReset = (payload: { code?: string }) => {
        localStorage.removeItem(storageKey(code));
        setPlayer(null);
        setError("");
        setSubmitting(false);
        if (payload.code && payload.code !== code) router.replace("/join");
      };
      socket.on("connect", reconnect);
      socket.on("game:state", setState);
      socket.on("game:reset", onReset);
      socket.on("player:state", setPlayer);
      if (socket.connected) reconnect();
      else socket.connect();
      return () => {
        socket.off("connect", reconnect);
        socket.off("game:state", setState);
        socket.off("game:reset", onReset);
        socket.off("player:state", setPlayer);
      };
    } catch {
      localStorage.removeItem(storageKey(code));
    }
  }, [code, router]);

  useEffect(() => {
    if (!player?.playerId) return;
    const socket = getSocket();
    let lastQuestionId: string | null = null;
    const onState = (s: GamePublicState) => {
      setState(s);
      const qid = s.question?.id ?? null;
      if (
        s.phase === "question" &&
        qid &&
        lastQuestionId !== null &&
        qid !== lastQuestionId
      ) {
        setSubmitting(false);
        setError("");
        setPlayer((prev) =>
          prev
            ? {
                ...prev,
                hasAnswered: false,
                selectedChoice: null,
                lastResult: null,
              }
            : prev
        );
      }
      if (qid) lastQuestionId = qid;
    };
    const onPlayer = (p: PlayerView) => {
      setPlayer(p);
      setSubmitting(false);
    };
    const onErr = (p: { message: string }) => setError(p.message);
    const onReset = (payload: { code?: string }) => {
      localStorage.removeItem(storageKey(code));
      setPlayer(null);
      setError("");
      setSubmitting(false);
      if (payload.code && payload.code !== code) router.replace("/join");
    };
    socket.on("game:state", onState);
    socket.on("player:state", onPlayer);
    socket.on("game:reset", onReset);
    socket.on("error", onErr);
    return () => {
      socket.off("game:state", onState);
      socket.off("player:state", onPlayer);
      socket.off("game:reset", onReset);
      socket.off("error", onErr);
    };
  }, [player?.playerId, code, router]);

  function doPlayerJoin(displayName: string) {
    const trimmed = displayName.trim();
    if (!trimmed || gameMissing) return;
    setJoining(true);
    setError("");
    try {
      localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    } catch {
      /* ignore */
    }
    const socket = getSocket();
    const emitJoin = () => {
      socket.emit(
        "player:join",
        { code: code.toUpperCase(), name: trimmed },
        (res: {
          ok?: boolean;
          message?: string;
          player?: PlayerView;
          state?: GamePublicState;
        }) => {
          setJoining(false);
          if (!res?.ok) {
            setError(res?.message || "Could not join");
            return;
          }
          if (res.player) {
            setPlayer(res.player);
            localStorage.setItem(
              storageKey(code),
              JSON.stringify({
                token: res.player.token,
                playerId: res.player.playerId,
              })
            );
          }
          if (res.state) setState(res.state);
        }
      );
    };
    if (socket.connected) emitJoin();
    else {
      socket.once("connect", emitJoin);
      socket.connect();
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    doPlayerJoin(name);
  }

  useEffect(() => {
    autoJoinAttempted.current = false;
  }, [code]);

  useEffect(() => {
    if (player || gameMissing || !presetName.trim() || autoJoinAttempted.current) return;
    if (typeof window !== "undefined" && localStorage.getItem(storageKey(code))) return;
    autoJoinAttempted.current = true;
    doPlayerJoin(presetName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, gameMissing, presetName, code]);

  function answer(choiceIndex: number) {
    if (!player || locked || player.hasAnswered || timeUp) return;
    setSubmitting(true);
    setError("");
    setPlayer((prev) =>
      prev ? { ...prev, hasAnswered: true, selectedChoice: choiceIndex } : prev
    );
    const socket = getSocket();
    socket.emit(
      "player:answer",
      { choiceIndex },
      (res: { ok?: boolean; message?: string }) => {
        setSubmitting(false);
        if (res && res.ok === false) {
          setError(res.message || "Answer failed");
          setPlayer((prev) =>
            prev
              ? { ...prev, hasAnswered: false, selectedChoice: null }
              : prev
          );
        }
      }
    );
  }

  const rank = useMemo(() => {
    if (!player || !state) return null;
    const idx = state.leaderboard.findIndex((r) => r.playerId === player.playerId);
    return idx >= 0 ? idx + 1 : null;
  }, [player, state]);

  const roundPoints = useMemo(() => {
    if (!player || !state) return null;
    const row = state.leaderboard.find((r) => r.playerId === player.playerId);
    return row?.lastPoints ?? player.lastResult?.points ?? null;
  }, [player, state]);

  const leadGap = useMemo(() => {
    if (!player || !state?.leader || rank === 1) return null;
    return state.leader.totalScore - player.totalScore;
  }, [player, state, rank]);

  const shell = {
    background: "#050a14",
    color: "#ffffff",
  } as const;
  const amber = "#f8b43c";

  if (!player) {
    return (
      <BrandProvider brand={brand}>
        <main
          className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-12"
          style={shell}
        >
          <div className="flex justify-center">
            <BrandMark href={null} size="lg" />
          </div>
          <h1 className="display mt-10 text-center text-[2.5rem] leading-none">
            Join {code}
          </h1>
          {gameMissing ? (
            <div className="mt-8 space-y-4">
              <p className="text-center text-sm text-bad">{error}</p>
              <button
                className="w-full rounded-xl py-4 text-base font-extrabold uppercase tracking-[0.12em]"
                style={{
                  background: "linear-gradient(180deg, #ffc14d, #f8b43c 55%, #e09a20)",
                  color: "#1a1200",
                }}
                onClick={() => router.push("/join")}
              >
                Back to join
              </button>
            </div>
          ) : (
            <form onSubmit={join} className="mt-8 space-y-5">
              <label className="block space-y-2">
                <span
                  className="block text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: amber }}
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
                  required
                  autoFocus
                />
              </label>
              {error && <p className="text-sm text-bad">{error}</p>}
              <button
                className="w-full rounded-xl py-4 text-base font-extrabold uppercase tracking-[0.12em] disabled:opacity-50"
                style={{
                  background: "linear-gradient(180deg, #ffc14d, #f8b43c 55%, #e09a20)",
                  color: "#1a1200",
                }}
                disabled={joining || !!gameMissing}
              >
                {joining ? "Joining…" : "Join game"}
              </button>
            </form>
          )}
        </main>
      </BrandProvider>
    );
  }

  const initial = player.name.charAt(0).toUpperCase();

  return (
    <BrandProvider brand={brand}>
      <main
        className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-6"
        style={shell}
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-lg font-extrabold"
              style={{ borderColor: amber, color: amber, background: "#0a1220" }}
            >
              {initial}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{player.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold" style={{ color: amber }}>
                <span aria-hidden>★</span>
                <span>{player.totalScore.toLocaleString()}</span>
                {rank ? <span style={{ color: "#9aa6c1" }}>· #{rank}</span> : null}
              </div>
            </div>
          </div>
          <div
            className="shrink-0 rounded-xl border px-3 py-1.5 text-center"
            style={{ borderColor: "rgba(248,180,60,0.55)" }}
          >
            <div
              className="text-[0.6rem] font-bold uppercase tracking-[0.16em]"
              style={{ color: amber }}
            >
              Code
            </div>
            <div
              className="text-sm font-bold tracking-[0.12em]"
              style={{ color: amber }}
            >
              {code}
            </div>
          </div>
        </header>

        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        <section className="mt-6 flex-1">
          {(!state || state.phase === "lobby") && (
            <div
              className="rounded-2xl border px-5 py-14 text-center"
              style={{ borderColor: "#2a3550", background: "#0a1220" }}
            >
              <h2 className="display text-3xl">You’re in</h2>
              <p className="mt-2" style={{ color: "#9aa6c1" }}>
                Waiting for the host to start…
              </p>
              <div className="display mt-8 text-6xl" style={{ color: amber }}>
                {state?.playerCount ?? "—"}
              </div>
              <div style={{ color: "#9aa6c1" }}>players</div>
            </div>
          )}

          {state?.phase === "question" && state.question && (
            <div>
              <p className="text-center text-sm" style={{ color: "#9aa6c1" }}>
                Question {state.questionIndex + 1}/{state.questionTotal}
              </p>
              <div className="mt-4">
                <CountdownTimer
                  remainingSec={remaining}
                  totalSec={state.timeLimitSec}
                  size="md"
                />
              </div>
              <h2 className="display mt-6 text-center text-[1.65rem] leading-snug text-white md:text-2xl">
                {state.question.prompt}
              </h2>
              <div className="mt-7 grid gap-3">
                {state.question.options.map((opt, i) => {
                  const selected = player.selectedChoice === i;
                  const letter = String.fromCharCode(65 + i);
                  return (
                    <button
                      key={i}
                      className="flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left text-[17px] font-semibold transition disabled:opacity-80"
                      style={
                        selected
                          ? {
                              borderColor: "#f4f0e6",
                              background: "#f4f0e6",
                              color: "#0b0e14",
                            }
                          : {
                              borderColor: "#2a3550",
                              background: "#0a1220",
                              color: "#ffffff",
                            }
                      }
                      disabled={locked}
                      onClick={() => answer(i)}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                        style={
                          selected
                            ? { background: "#0b0e14", color: amber }
                            : { background: "rgba(248,180,60,0.15)", color: amber }
                        }
                      >
                        {letter}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {player.hasAnswered && (
                <div className="mt-8 text-center" style={{ color: amber }}>
                  <div className="text-lg" aria-hidden>
                    🔒
                  </div>
                  <p className="mt-1 text-sm font-semibold">
                    Answer locked in — wait for the reveal.
                  </p>
                </div>
              )}
              {!player.hasAnswered && timeUp && (
                <p className="mt-8 text-center text-sm text-bad">
                  Time’s up — no answer recorded.
                </p>
              )}
            </div>
          )}

          {state?.phase === "reveal" && state.question && (
            <div className="space-y-5">
              <h2 className="display text-center text-2xl text-white">Results</h2>
              <div className="text-center">
                {player.lastResult?.isCorrect ? (
                  <>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good text-3xl font-bold text-ink">
                      ✓
                    </div>
                    <p className="mt-3 text-2xl font-bold text-good">Correct!</p>
                    <p className="display text-3xl text-good">
                      +{player.lastResult.points} pts
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bad/80 text-3xl font-bold text-ink">
                      ✕
                    </div>
                    <p className="mt-3 text-2xl font-bold text-bad">
                      {player.hasAnswered ? "Incorrect" : "No answer"}
                    </p>
                    <p style={{ color: "#9aa6c1" }}>+0 pts</p>
                  </>
                )}
              </div>

              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#9aa6c1" }}
                >
                  Correct answer
                </div>
                <div
                  className="mt-2 rounded-xl border px-4 py-3.5 font-semibold text-white"
                  style={{ borderColor: "#2a3550", background: "#0a1220" }}
                >
                  {state.question.options[state.question.correctIndex ?? -1] ?? "—"}
                </div>
              </div>

              <div
                className="rounded-2xl border px-5 py-5 text-center"
                style={{
                  borderColor: "rgba(248,180,60,0.55)",
                  background: "#0a1220",
                  boxShadow: "0 0 28px rgba(248,180,60,0.12)",
                }}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#9aa6c1" }}
                >
                  You
                </div>
                <p className="display mt-1 text-5xl" style={{ color: amber }}>
                  {rank ? ordinal(rank) : "—"}
                </p>
                <p className="mt-2 text-sm text-white">
                  {player.totalScore.toLocaleString()} pts total
                  {roundPoints != null && roundPoints > 0 ? (
                    <span style={{ color: "#3ecf8e" }}>
                      {" "}
                      · +{roundPoints} this round
                    </span>
                  ) : null}
                </p>
              </div>

              {state.leader && rank !== 1 && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm text-white"
                  style={{ borderColor: "#2a3550", background: "#0a1220" }}
                >
                  <span style={{ color: amber }}>★</span> You’re in{" "}
                  {rank ? ordinal(rank) : "—"} place
                  {leadGap != null && leadGap > 0 ? (
                    <span style={{ color: "#9aa6c1" }}>
                      {" "}
                      — leader ahead by {leadGap.toLocaleString()} pts
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {state?.phase === "between" && (
            <div
              className="rounded-2xl border px-5 py-12 text-center"
              style={{ borderColor: "#2a3550", background: "#0a1220" }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: amber }}
              >
                Between rounds
              </div>
              <h2 className="display mt-3 text-3xl text-white">
                You’re {rank ? ordinal(rank) : "in"}
              </h2>
              <p className="mt-2 text-white">
                {player.totalScore.toLocaleString()} pts
                {roundPoints != null && roundPoints > 0
                  ? ` · +${roundPoints} last round`
                  : ""}
              </p>
              <p className="mt-6" style={{ color: "#9aa6c1" }}>
                Up next: question {state.questionIndex + 1} of {state.questionTotal}
              </p>
            </div>
          )}

          {state?.phase === "finished" && (
            <div className="space-y-5 py-4 text-center">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#9aa6c1" }}
              >
                Game over
              </div>
              <h2 className="display text-4xl" style={{ color: amber }}>
                {state.winner?.name || "—"}
              </h2>
              <p style={{ color: "#9aa6c1" }}>
                wins with {(state.winner?.totalScore ?? 0).toLocaleString()} pts
              </p>
              <div
                className="rounded-2xl border px-5 py-5 text-left"
                style={{
                  borderColor: "rgba(248,180,60,0.55)",
                  background: "#0a1220",
                }}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#9aa6c1" }}
                >
                  You finished
                </div>
                <p className="display mt-1 text-4xl" style={{ color: amber }}>
                  {rank ? ordinal(rank) : "—"}
                </p>
                <p className="mt-1 text-white">
                  {player.totalScore.toLocaleString()} pts
                </p>
              </div>
              <ol className="space-y-2 text-left">
                {state.leaderboard.slice(0, 5).map((row, i) => (
                  <li
                    key={row.playerId}
                    className="flex justify-between rounded-xl border px-3 py-2.5 text-sm"
                    style={
                      row.playerId === player.playerId
                        ? {
                            borderColor: "rgba(248,180,60,0.5)",
                            background: "rgba(248,180,60,0.1)",
                          }
                        : { borderColor: "#2a3550", background: "#0a1220" }
                    }
                  >
                    <span className="text-white">
                      <span className="mr-2" style={{ color: amber }}>
                        {i + 1}.
                      </span>
                      {row.name}
                    </span>
                    <span className="tabular-nums text-white">
                      {row.totalScore.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </main>
    </BrandProvider>
  );
}

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  useEffect(() => {
    void params.then((p) => setCode(p.code.toUpperCase()));
  }, [params]);
  if (!code) return <main className="p-10 text-muted">Loading…</main>;
  return (
    <Suspense fallback={<main className="p-10 text-muted">Loading…</main>}>
      <PlayInner code={code} />
    </Suspense>
  );
}
