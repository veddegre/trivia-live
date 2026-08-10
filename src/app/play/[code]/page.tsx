"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useQuestionCountdown } from "@/hooks/useQuestionCountdown";
import type { BrandConfig } from "@/lib/branding";
import { getSocket } from "@/lib/socket-client";
import type { GamePublicState, PlayerView } from "@/lib/types";

const storageKey = (code: string) => `trivia-player:${code}`;

function PlayInner({ code }: { code: string }) {
  const search = useSearchParams();
  const presetName = search.get("name") || "";
  const [name, setName] = useState(presetName);
  const [player, setPlayer] = useState<PlayerView | null>(null);
  const [state, setState] = useState<GamePublicState | null>(null);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remaining = useQuestionCountdown(
    state?.questionOpenedAt,
    state?.timeLimitSec,
    state?.phase === "question"
  );

  const timeUp = remaining === 0;
  const locked =
    !!player?.hasAnswered || timeUp || state?.phase !== "question" || submitting;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/games/by-code/${code}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.brand) setBrand(data.brand as BrandConfig);
      } catch {
        /* site brand remains */
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
          (res: { ok?: boolean; message?: string; player?: PlayerView; state?: GamePublicState }) => {
            if (!res?.ok) {
              localStorage.removeItem(storageKey(code));
              return;
            }
            if (res.player) setPlayer(res.player);
            if (res.state) setState(res.state);
          }
        );
      };
      const onReset = () => {
        localStorage.removeItem(storageKey(code));
        setPlayer(null);
        setError("");
        setSubmitting(false);
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
  }, [code]);

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
    const onReset = () => {
      localStorage.removeItem(storageKey(code));
      setPlayer(null);
      setError("");
      setSubmitting(false);
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
  }, [player?.playerId, code]);

  function join(e: FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError("");
    const socket = getSocket();
    const doJoin = () => {
      socket.emit(
        "player:join",
        { code, name },
        (res: { ok?: boolean; message?: string; player?: PlayerView; state?: GamePublicState }) => {
          setJoining(false);
          if (!res?.ok) {
            setError(res?.message || "Could not join");
            return;
          }
          if (res.player) {
            setPlayer(res.player);
            localStorage.setItem(
              storageKey(code),
              JSON.stringify({ token: res.player.token, playerId: res.player.playerId })
            );
          }
          if (res.state) setState(res.state);
        }
      );
    };
    if (socket.connected) doJoin();
    else {
      socket.once("connect", doJoin);
      socket.connect();
    }
  }

  function answer(choiceIndex: number) {
    if (!player || locked || player.hasAnswered || timeUp) return;
    setSubmitting(true);
    setError("");
    // Optimistic lock — one guess only
    setPlayer((prev) =>
      prev
        ? { ...prev, hasAnswered: true, selectedChoice: choiceIndex }
        : prev
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

  if (!player) {
    return (
      <BrandProvider brand={brand}>
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
          <BrandMark />
          <h1 className="display mt-8 text-4xl">Join {code}</h1>
          <form onSubmit={join} className="panel mt-6 space-y-4 rounded-2xl p-5">
            <label className="block space-y-2">
              <span className="text-sm text-muted">Display name</span>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                required
                autoFocus
              />
            </label>
            {error && <p className="text-sm text-bad">{error}</p>}
            <button className="btn btn-primary w-full" disabled={joining}>
              {joining ? "Joining…" : "Join game"}
            </button>
          </form>
        </main>
      </BrandProvider>
    );
  }

  return (
    <BrandProvider brand={brand}>
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <BrandMark href={null} size="sm" />
            <div className="text-sm text-muted">
              {player.name} · {player.totalScore} pts
              {rank ? ` · #${rank}` : ""}
            </div>
          </div>
          <div className="rounded-lg border border-line px-3 py-1 text-sm text-muted">
            {code}
          </div>
        </header>

        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        <section className="panel anim-rise mt-6 flex-1 rounded-2xl p-5">
          {(!state || state.phase === "lobby") && (
            <div className="py-10 text-center">
              <h2 className="display text-3xl">You’re in</h2>
              <p className="mt-2 text-muted">Waiting for the host to start…</p>
              <div className="mt-6 text-5xl text-amber">{state?.playerCount ?? "—"}</div>
              <div className="text-muted">players</div>
            </div>
          )}

          {state?.phase === "question" && state.question && (
            <div>
              <div className="flex justify-between text-sm text-muted">
                <span>
                  Q{state.questionIndex + 1}/{state.questionTotal}
                </span>
                <span>One guess</span>
              </div>

              <div className="mt-4">
                <CountdownTimer
                  remainingSec={remaining}
                  totalSec={state.timeLimitSec}
                  size="md"
                />
              </div>

              <h2 className="display mt-5 text-2xl leading-snug">{state.question.prompt}</h2>
              <div className="mt-5 grid gap-2">
                {state.question.options.map((opt, i) => {
                  const selected = player.selectedChoice === i;
                  return (
                    <button
                      key={i}
                      className={`btn w-full justify-start text-left disabled:opacity-60 ${
                        selected ? "btn-primary" : "btn-ghost"
                      }`}
                      disabled={locked}
                      onClick={() => answer(i)}
                    >
                      <span className={selected ? "" : "text-amber"}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {player.hasAnswered && (
                <p className="mt-4 text-center text-good">
                  Answer locked in — wait for the reveal.
                </p>
              )}
              {!player.hasAnswered && timeUp && (
                <p className="mt-4 text-center text-bad">Time’s up — no answer recorded.</p>
              )}
            </div>
          )}

          {state?.phase === "reveal" && state.question && (
            <div>
              <h2 className="display text-2xl">Results</h2>
              <p className="mt-2 text-muted">{state.question.prompt}</p>
              <p className="mt-4 text-lg">
                {player.lastResult?.isCorrect ? (
                  <span className="text-good">
                    Correct · +{player.lastResult.points} pts
                  </span>
                ) : player.hasAnswered ? (
                  <span className="text-bad">Incorrect · +0</span>
                ) : (
                  <span className="text-muted">No answer · +0</span>
                )}
              </p>
              <p className="mt-2 text-chalk">
                Correct answer:{" "}
                {state.question.options[state.question.correctIndex ?? -1] ?? "—"}
              </p>
            </div>
          )}

          {state?.phase === "finished" && (
            <div className="py-8 text-center">
              <div className="text-sm uppercase tracking-[0.2em] text-muted">Game over</div>
              <h2 className="display mt-3 text-4xl text-amber">
                {state.winner?.name || "—"}
              </h2>
              <p className="mt-2 text-muted">wins with {state.winner?.totalScore ?? 0} pts</p>
              <p className="mt-6 text-chalk">
                You finished with {player.totalScore} pts
                {rank ? ` (#${rank})` : ""}
              </p>
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
