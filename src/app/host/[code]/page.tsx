"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import { CountdownTimer } from "@/components/CountdownTimer";
import { JoinQr } from "@/components/JoinQr";
import { useQuestionCountdown } from "@/hooks/useQuestionCountdown";
import { betweenHeadline } from "@/lib/between-copy";
import type { BrandConfig } from "@/lib/branding";
import { getSocket } from "@/lib/socket-client";
import type { GamePublicState, LeaderboardEntry } from "@/lib/types";

const medal = {
  0: {
    bar: "bg-gradient-to-b from-[#ffe08a] via-[#f0a820] to-[#c8860a]",
    ring: "border-[#f0a820] shadow-[0_0_24px_rgba(240,168,32,0.45)]",
    text: "text-amber",
    chip: "bg-amber text-ink",
  },
  1: {
    bar: "bg-gradient-to-b from-[#e8eef6] via-[#a8b4c4] to-[#6d7a8c]",
    ring: "border-[#c5cdd8] shadow-[0_0_18px_rgba(197,205,216,0.35)]",
    text: "text-silver",
    chip: "bg-silver text-ink",
  },
  2: {
    bar: "bg-gradient-to-b from-[#e0a07a] via-[#c47a4a] to-[#8f5533]",
    ring: "border-[#c47a4a] shadow-[0_0_18px_rgba(196,122,74,0.35)]",
    text: "text-bronze",
    chip: "bg-bronze text-ink",
  },
} as const;

function Podium({ podium }: { podium: LeaderboardEntry[] }) {
  const order = [
    { placeIndex: 1, height: "h-36 md:h-44" },
    { placeIndex: 0, height: "h-48 md:h-60" },
    { placeIndex: 2, height: "h-28 md:h-36" },
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-3 items-end gap-3 md:gap-5">
      {order.map(({ placeIndex, height }) => {
        const row = podium[placeIndex];
        const place = placeIndex + 1;
        const style = medal[placeIndex];
        const initial = row?.name?.trim()?.charAt(0)?.toUpperCase() || "";
        return (
          <div key={place} className="flex min-w-0 flex-col items-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-ink-2 text-xl font-extrabold md:h-16 md:w-16 md:text-2xl ${style.ring} ${style.text}`}
            >
              {initial || "·"}
            </div>
            <div className="mt-3 w-full truncate text-center display text-lg text-chalk md:text-2xl">
              {row?.name || "—"}
            </div>
            <div className={`mt-1 text-sm font-semibold tabular-nums md:text-base ${style.text}`}>
              {row ? row.totalScore.toLocaleString() : ""}
            </div>
            <div
              className={`relative mt-4 flex w-full items-end justify-center rounded-t-2xl ${style.bar} ${height}`}
              style={{
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,0.25), 0 12px 28px rgba(0,0,0,0.35)",
              }}
            >
              <span className="display pb-4 text-5xl text-ink md:text-6xl">{place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StandingsList({
  rows,
  showDeltas,
  title = "In the lead",
}: {
  rows: LeaderboardEntry[];
  showDeltas?: boolean;
  title?: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-amber" aria-hidden>
          ★
        </span>
        <h2 className="display text-xl uppercase tracking-[0.12em] text-amber md:text-2xl">
          {title}
        </h2>
      </div>
      <ol className="mt-5 space-y-2">
        {rows.length === 0 && <li className="text-muted">No scores yet</li>}
        {rows.map((row, i) => {
          const style = i < 3 ? medal[i as 0 | 1 | 2] : null;
          return (
            <li
              key={row.playerId}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                i === 0
                  ? "border-amber/50 bg-amber/10"
                  : "border-line bg-ink-2/40"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`display w-6 shrink-0 text-xl ${
                    style ? style.text : "text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-ink text-sm font-bold ${
                    style ? style.ring.split(" ")[0] + " " + style.text : "border-line text-chalk"
                  }`}
                >
                  {row.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate font-semibold uppercase tracking-wide text-chalk">
                  {row.name}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end leading-tight">
                <span
                  className={`font-bold tabular-nums ${i === 0 ? "text-amber" : "text-chalk"}`}
                >
                  {row.totalScore.toLocaleString()}
                </span>
                {showDeltas && row.lastPoints != null && (
                  <span className="text-xs font-semibold text-amber">
                    +{row.lastPoints}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function HostInner({ code }: { code: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const hostToken = search.get("token") || "";
  const [state, setState] = useState<GamePublicState | null>(null);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [manualJoinUrl, setManualJoinUrl] = useState("");

  const liveCode = (state?.code || code).toUpperCase();

  useEffect(() => {
    const base = (
      process.env.NEXT_PUBLIC_PUBLIC_URL || window.location.origin
    ).replace(/\/$/, "");
    setQrUrl(`${base}/join?code=${encodeURIComponent(liveCode)}`);
    setManualJoinUrl(`${base}/join`);
  }, [liveCode]);

  const remaining = useQuestionCountdown(
    state?.questionOpenedAt,
    state?.timeLimitSec,
    state?.phase === "question"
  );

  useEffect(() => {
    if (state?.brand) setBrand(state.brand);
  }, [state?.brand]);

  useEffect(() => {
    if (!hostToken) {
      setError("Missing host token. Open this page from Admin.");
      return;
    }
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit(
        "host:join",
        { code, hostToken },
        (res: { ok?: boolean; message?: string; state?: GamePublicState }) => {
          if (!res?.ok) {
            setError(res?.message || "Could not join as host");
            setState(null);
          } else {
            setError("");
            if (res.state) setState(res.state);
          }
        }
      );
    };

    const onReset = (payload: { code: string; hostToken?: string }) => {
      setError("");
      if (payload.hostToken && payload.code) {
        router.replace(
          `/host/${payload.code}?token=${encodeURIComponent(payload.hostToken)}`
        );
      }
    };

    socket.on("connect", onConnect);
    socket.on("game:state", setState);
    socket.on("game:reset", onReset);
    socket.on("error", (p: { message: string }) => setError(p.message));
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("game:state", setState);
      socket.off("game:reset", onReset);
    };
  }, [code, hostToken, router]);

  const top = useMemo(() => state?.leaderboard.slice(0, 10) || [], [state]);
  const podium = useMemo(() => state?.leaderboard.slice(0, 3) || [], [state]);
  const roster = useMemo(() => state?.leaderboard || [], [state]);

  const correctPct = useMemo(() => {
    if (!state?.playerCount) return 0;
    const n = state.leaderboard.filter((r) => (r.lastPoints ?? 0) > 0).length;
    return Math.round((100 * n) / state.playerCount);
  }, [state]);

  function emit(event: string) {
    const socket = getSocket();
    socket.emit(event, (res: { ok?: boolean; message?: string }) => {
      if (res && res.ok === false) setError(res.message || "Action failed");
    });
  }

  function playAgain() {
    if (
      !confirm(
        "Play again? This clears players and scores, keeps the questions, and issues a new join code."
      )
    ) {
      return;
    }
    const socket = getSocket();
    socket.emit(
      "host:reset",
      (res: {
        ok?: boolean;
        message?: string;
        code?: string;
        hostToken?: string;
      }) => {
        if (res && res.ok === false) {
          setError(res.message || "Reset failed");
          return;
        }
        if (res?.code && res.hostToken) {
          router.replace(
            `/host/${res.code}?token=${encodeURIComponent(res.hostToken)}`
          );
        }
      }
    );
  }

  if (!state) {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
          <BrandMark href={null} badgeLast size="lg" />
          {error ? (
            <p className="mt-6 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
              {error}
            </p>
          ) : (
            <p className="mt-10 text-muted">Waiting for connection…</p>
          )}
        </main>
      </BrandProvider>
    );
  }

  // ── QUESTION (TV mock) ──
  if (state.phase === "question" && state.question) {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 md:py-8">
          <header className="flex items-start justify-between gap-4">
            <BrandMark href={null} badgeLast size="lg" />
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-chalk">
                Join code
              </div>
              <div className="display text-2xl tracking-[0.14em] text-amber md:text-3xl">
                {liveCode}
              </div>
            </div>
          </header>

          <div className="mt-8 grid items-center gap-4 border-y border-line/60 py-5 md:grid-cols-3">
            <div className="flex items-center justify-center gap-2 text-sm md:justify-start">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-sm font-extrabold text-ink">
                ?
              </span>
              <span className="font-semibold text-chalk">
                Question {state.questionIndex + 1} / {state.questionTotal}
              </span>
            </div>
            <CountdownTimer
              remainingSec={remaining}
              totalSec={state.timeLimitSec}
              size="lg"
            />
            <div className="flex items-center justify-center gap-2 text-sm md:justify-end">
              <span className="text-amber" aria-hidden>
                ●●
              </span>
              <span className="font-semibold text-chalk">
                {state.answerCount} / {state.playerCount} answered
              </span>
            </div>
          </div>

          <h2 className="display mx-auto mt-10 max-w-4xl text-center text-3xl leading-tight md:text-5xl">
            {state.question.prompt}
          </h2>

          <ol className="mx-auto mt-10 grid w-full max-w-4xl gap-4 md:grid-cols-2">
            {state.question.options.map((opt, i) => (
              <li
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-line bg-ink-2/70 px-5 py-5 text-xl md:text-2xl"
              >
                <span className="choice-letter choice-letter-lg">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-semibold">{opt}</span>
              </li>
            ))}
          </ol>

          <div className="mt-auto flex justify-center pt-8">
            <button
              className="btn btn-ghost uppercase tracking-wide"
              onClick={() => emit("host:lock")}
            >
              Lock now
            </button>
          </div>
        </main>
      </BrandProvider>
    );
  }

  // ── REVEAL (TV mock) ──
  if (state.phase === "reveal" && state.question) {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
          <header className="flex items-center justify-between gap-4">
            <BrandMark href={null} badgeLast size="lg" />
            <div className="text-center">
              <div className="text-amber">★★★</div>
              <h1 className="display text-3xl uppercase tracking-wide text-amber md:text-5xl">
                Results revealed!
              </h1>
            </div>
            <div className="w-28" />
          </header>

          <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
            <section className="panel rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-2 text-amber">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-xs font-extrabold text-ink">
                  ?
                </span>
                <span className="text-sm font-bold uppercase tracking-[0.16em]">
                  Question {state.questionIndex + 1}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold md:text-2xl">
                {state.question.prompt}
              </h2>
              <ol className="mt-6 space-y-3">
                {state.question.options.map((opt, i) => {
                  const correct = state.question?.correctIndex === i;
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
                        correct
                          ? "border-good bg-good/10"
                          : "border-line bg-ink-2/40"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                          correct
                            ? "bg-good text-ink"
                            : "border border-line text-muted"
                        }`}
                      >
                        {correct ? "✓" : String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1 font-semibold">
                        {String.fromCharCode(65 + i)}. {opt}
                      </span>
                      {correct && (
                        <span className="text-sm font-bold uppercase tracking-wide text-good">
                          Correct
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-6 text-sm font-semibold text-good">
                {correctPct}% of players answered correctly
              </p>
            </section>

            <aside className="panel rounded-2xl p-6">
              <StandingsList rows={top} showDeltas title="In the lead" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-amber">
                Points earned this round
              </p>
            </aside>
          </div>

          <div className="mt-8 flex justify-center pb-4">
            <button
              className="btn border-2 border-amber bg-transparent px-14 text-base uppercase tracking-[0.16em] text-amber hover:bg-amber/10"
              onClick={() => emit("host:next")}
            >
              {state.questionIndex + 1 >= state.questionTotal
                ? "Show winner"
                : "Continue"}
            </button>
          </div>
        </main>
      </BrandProvider>
    );
  }

  // ── BETWEEN (TV mock, no host photo) ──
  if (state.phase === "between") {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <BrandMark href={null} badgeLast size="lg" />
            <div className="text-right">
              <div className="text-sm font-bold uppercase tracking-[0.16em] text-amber">
                Round {state.questionIndex} of {state.questionTotal}
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                {Array.from({ length: state.questionTotal }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full ${
                      i < state.questionIndex ? "bg-amber" : "bg-line"
                    }`}
                  />
                ))}
              </div>
            </div>
          </header>

          <div className="mt-8 grid flex-1 items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <section className="flex flex-col items-center text-center">
              <h1 className="display text-5xl uppercase tracking-wide md:text-7xl">
                {betweenHeadline(state.questionIndex, state.questionTotal)}
              </h1>
              <div className="mt-4 flex items-center gap-3 text-amber">
                <div className="h-px w-16 bg-amber" />
                <span>★</span>
                <div className="h-px w-16 bg-amber" />
              </div>
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-amber">
                Up next:
              </p>
              <p className="display mt-2 text-3xl md:text-4xl">
                Question {state.questionIndex + 1} of {state.questionTotal}
              </p>

              {state.leader && (
                <div className="mt-10 w-full max-w-md rounded-2xl border-2 border-amber/60 bg-amber/10 px-6 py-5 shadow-[0_0_40px_rgba(240,168,32,0.15)]">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber text-2xl text-ink">
                      ★
                    </span>
                    <div className="text-left">
                      <div className="display text-2xl uppercase tracking-wide">
                        {state.leader.name}
                      </div>
                      <div className="display text-3xl text-amber">
                        {state.leader.totalScore.toLocaleString()}{" "}
                        <span className="text-base">pts</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                    <div className="h-px flex-1 bg-line" />
                    Current leader
                    <div className="h-px flex-1 bg-line" />
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary anim-glow mt-10 px-10 text-base uppercase tracking-wide"
                onClick={() => emit("host:openQuestion")}
              >
                ▶ Start question {state.questionIndex + 1}
              </button>
            </section>

            <aside className="panel rounded-2xl p-6">
              <StandingsList rows={top} title="Leaderboard" />
              <p className="mt-6 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">
                Points update after each question
              </p>
            </aside>
          </div>
        </main>
      </BrandProvider>
    );
  }

  // ── FINISHED ──
  if (state.phase === "finished") {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
          <header className="flex items-center justify-between gap-4">
            <BrandMark href={null} badgeLast size="lg" />
            <span className="rounded-lg border border-line px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Host controls
            </span>
          </header>

          <div className="mt-6 flex flex-1 flex-col">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-amber/50 bg-amber/15 text-amber">
                ★
              </div>
              <h1 className="display text-4xl uppercase tracking-wide md:text-6xl">
                Game finished!
              </h1>
              <p className="mt-2 text-lg text-muted">Great game, everyone!</p>
            </div>

            <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
              <section className="panel flex flex-col justify-end rounded-2xl px-4 pb-0 pt-10 md:px-8">
                {podium.length === 0 ? (
                  <p className="pb-16 text-center text-muted">No players</p>
                ) : (
                  <Podium podium={podium} />
                )}
              </section>
              <aside className="panel rounded-2xl p-6">
                <StandingsList rows={top} title="Final standings" />
              </aside>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 pb-4">
              <button
                className="btn btn-primary px-10 text-base uppercase tracking-wide"
                onClick={playAgain}
              >
                ▶ Play again
              </button>
              <Link
                href="/admin?tab=games"
                className="text-sm font-semibold uppercase tracking-[0.14em] text-muted transition hover:text-chalk"
              >
                New game →
              </Link>
            </div>
          </div>
        </main>
      </BrandProvider>
    );
  }

  // ── LOBBY / DRAFT (TV mock) ──
  const amber = "var(--amber)";
  const line = "var(--line)";
  const nextQ = Math.max(1, (state.questionIndex ?? 0) + 1);

  return (
    <BrandProvider brand={brand}>
      <main
        className="flex min-h-screen flex-col bg-ink text-chalk"
      >
        {error && (
          <p className="mx-8 mt-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad md:mx-12">
            {error}
          </p>
        )}

        <div className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-1 px-6 py-6 md:px-10 md:py-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          {/* LEFT column: title + QR / join */}
          <section
            className="flex min-h-0 flex-col lg:border-r lg:pr-10"
            style={{ borderColor: line }}
          >
            {/* —— ★ Title ★ ——  (stars sit next to the title, not mid-line) */}
            <div className="flex items-center justify-center gap-3 md:gap-4">
              <span
                className="h-px w-14 shrink-0 md:w-24"
                style={{ background: amber }}
                aria-hidden
              />
              <span className="text-sm leading-none md:text-base" style={{ color: amber }} aria-hidden>
                ★
              </span>
              <h1 className="display shrink-0 text-center text-[clamp(2.1rem,4.2vw,3.25rem)] font-extrabold tracking-tight text-chalk">
                {state.title}
              </h1>
              <span className="text-sm leading-none md:text-base" style={{ color: amber }} aria-hidden>
                ★
              </span>
              <span
                className="h-px w-14 shrink-0 md:w-24"
                style={{ background: amber }}
                aria-hidden
              />
            </div>

            {state.status === "DRAFT" && (
              <div className="mt-6 flex justify-center">
                <button
                  className="rounded-2xl px-7 py-3.5 text-sm font-extrabold uppercase tracking-[0.14em]"
                  style={{ background: amber, color: "#1a1200" }}
                  onClick={() => emit("host:start")}
                >
                  Open lobby
                </button>
              </div>
            )}

            <div className="flex min-h-0 flex-1 items-center py-8">
              <div className="flex w-full flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10 lg:gap-12">
                <div className="shrink-0 overflow-hidden rounded-[6px] bg-white p-[14px]">
                  {qrUrl ? (
                    <JoinQr url={qrUrl} size={320} className="!rounded-none !p-0" />
                  ) : (
                    <div className="h-[320px] w-[320px] bg-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="condensed text-[15px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: amber }}
                  >
                    Join code
                  </div>
                  <div
                    className="condensed mt-0.5 font-bold uppercase leading-[0.9] tracking-[0.02em]"
                    style={{
                      color: amber,
                      fontSize: "clamp(4.5rem, 11vw, 7.75rem)",
                      textShadow: `0 0 40px ${amber}33`,
                    }}
                  >
                    {liveCode}
                  </div>
                  {!connected && (
                    <p className="mt-2 text-sm text-muted">
                      Connecting…
                    </p>
                  )}

                  {/* Active amber rule + caret between code and join URL */}
                  <div className="relative mt-8" aria-hidden>
                    <div
                      className="h-[3px] w-full rounded-full"
                      style={{
                        background: amber,
                        boxShadow: `0 0 14px ${amber}55`,
                      }}
                    />
                    <svg
                      viewBox="0 0 20 12"
                      className="absolute left-1/2 top-[1px] h-3 w-5 -translate-x-1/2"
                      fill={amber}
                    >
                      <path d="M0 0h20L10 12z" />
                    </svg>
                  </div>

                  <div className="pt-7">
                    <div className="condensed flex items-center gap-2.5 text-[15px] font-bold uppercase tracking-[0.24em] text-chalk">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0"
                        style={{ color: amber }}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                      </svg>
                      Players join at
                    </div>
                    <p
                      className="mt-2.5 whitespace-nowrap font-mono text-[clamp(1.05rem,1.9vw,1.55rem)] font-semibold tracking-tight"
                      style={{ color: amber }}
                    >
                      {manualJoinUrl || "…/join"}
                    </p>
                    {state.allowLateJoin === false && (
                      <p className="mt-1 text-xs text-muted">
                        Late joins off
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT column: status aligned with title */}
          <aside className="flex min-h-0 flex-col pt-8 lg:pl-10 lg:pt-0">
            <div className="flex items-center gap-3 lg:min-h-[2.85rem]">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: state.status === "DRAFT" ? "var(--muted)" : "#0f9f6e",
                }}
              />
              <span
                className="condensed text-[14px] font-semibold uppercase tracking-[0.2em]"
                style={{
                  color: state.status === "DRAFT" ? "var(--muted)" : "#0f9f6e",
                }}
              >
                {state.status === "DRAFT" ? "Draft" : "Lobby open"}
              </span>
            </div>

            <div className="mt-7 border-t pt-6" style={{ borderColor: line }}>
              <div className="condensed text-[15px] font-bold uppercase tracking-[0.22em] text-chalk">
                Players ready
              </div>
              <div className="condensed mt-1 text-[clamp(5.5rem,11vw,8rem)] font-bold leading-none tabular-nums text-chalk">
                {state.playerCount}
              </div>
            </div>

            <div
              className="mt-7 flex min-h-0 flex-1 flex-col border-t pt-5"
              style={{ borderColor: line }}
            >
              <div className="condensed text-[12px] font-semibold uppercase tracking-[0.22em] text-muted">
                Players
              </div>
              <ul className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto">
                {roster.length === 0 && (
                  <li className="text-[15px] italic text-muted">
                    Waiting for players…
                  </li>
                )}
                {roster.map((row) => (
                  <li
                    key={row.playerId}
                    className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 shrink-0"
                      style={{ color: amber }}
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
                    </svg>
                    <span className="text-base font-semibold text-chalk">
                      {row.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto flex flex-col gap-3.5 pt-8">
              <button
                className="condensed flex w-full items-center justify-center gap-2.5 rounded-2xl py-[1.05rem] text-[15px] font-bold uppercase tracking-[0.14em] disabled:opacity-40"
                style={{ background: amber, color: "#1a1200" }}
                onClick={() => emit("host:openQuestion")}
                disabled={state.status === "DRAFT"}
              >
                <span aria-hidden className="text-base leading-none">
                  ▶
                </span>
                Start question {nextQ}
              </button>
              <button
                className="condensed flex w-full items-center justify-center gap-2.5 rounded-2xl border-[1.5px] py-[1.05rem] text-[15px] font-bold uppercase tracking-[0.14em]"
                style={{
                  borderColor: amber,
                  color: amber,
                  background: "transparent",
                }}
                onClick={() => emit("host:finish")}
              >
                <span aria-hidden className="text-sm leading-none">
                  ■
                </span>
                End game
              </button>
            </div>
          </aside>
        </div>
      </main>
    </BrandProvider>
  );
}

export default function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  useEffect(() => {
    void params.then((p) => setCode(p.code.toUpperCase()));
  }, [params]);

  if (!code) return <main className="p-10 text-muted">Loading…</main>;

  return (
    <Suspense fallback={<main className="p-10 text-muted">Loading host…</main>}>
      <HostInner code={code} />
    </Suspense>
  );
}
