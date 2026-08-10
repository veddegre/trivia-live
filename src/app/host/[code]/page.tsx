"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useQuestionCountdown } from "@/hooks/useQuestionCountdown";
import type { BrandConfig } from "@/lib/branding";
import { getSocket } from "@/lib/socket-client";
import type { GamePublicState } from "@/lib/types";

function HostInner({ code }: { code: string }) {
  const search = useSearchParams();
  const hostToken = search.get("token") || "";
  const [state, setState] = useState<GamePublicState | null>(null);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

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
      socket.emit("host:join", { code, hostToken }, (res: { ok?: boolean; message?: string; state?: GamePublicState }) => {
        if (!res?.ok) setError(res?.message || "Could not join as host");
        else if (res.state) setState(res.state);
      });
    };

    const onReset = () => {
      setError("");
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
  }, [code, hostToken]);

  const top = useMemo(() => state?.leaderboard.slice(0, 10) || [], [state]);

  function emit(event: string) {
    const socket = getSocket();
    socket.emit(event, (res: { ok?: boolean; message?: string }) => {
      if (res && res.ok === false) setError(res.message || "Action failed");
    });
  }

  return (
    <BrandProvider brand={brand}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <BrandMark href={null} />
            <h1 className="display mt-1 text-4xl md:text-5xl">{state?.title || "Host"}</h1>
            <p className="mt-2 text-muted">
              Join code{" "}
              <span className="display text-3xl tracking-[0.2em] text-amber">{code}</span>
              {" · "}
              {connected ? "live" : "connecting…"}
              {state ? ` · ${state.playerCount} players` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {state?.phase === "lobby" && (
              <button className="btn btn-primary" onClick={() => emit("host:openQuestion")}>
                Start question 1
              </button>
            )}
            {state?.status === "DRAFT" && (
              <button className="btn btn-primary" onClick={() => emit("host:start")}>
                Open lobby
              </button>
            )}
            {state?.phase === "question" && (
              <button className="btn btn-ghost" onClick={() => emit("host:lock")}>
                Lock now
              </button>
            )}
            {state?.phase === "reveal" && (
              <button className="btn btn-primary" onClick={() => emit("host:next")}>
                {state.questionIndex + 1 >= state.questionTotal
                  ? "Show winner"
                  : "Next question"}
              </button>
            )}
            {state?.phase === "finished" && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (
                    confirm(
                      "Play again? This clears all players and scores. Same questions and join code."
                    )
                  ) {
                    emit("host:reset");
                  }
                }}
              >
                Play again
              </button>
            )}
            {state && state.phase !== "finished" && (
              <button className="btn btn-danger" onClick={() => emit("host:finish")}>
                End game
              </button>
            )}
          </div>
        </header>

        {error && (
          <p className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}

        <div className="mt-8 grid flex-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="panel anim-rise rounded-2xl p-6">
            {!state && <p className="text-muted">Waiting for connection…</p>}
            {state?.phase === "lobby" && (
              <div>
                <h2 className="display text-3xl">Lobby open</h2>
                <p className="mt-2 text-lg text-muted">
                  Players join at <span className="text-chalk">/join</span> with code{" "}
                  <span className="text-amber">{code}</span>
                </p>
                <div className="display mt-8 inline-block px-4 py-2 text-7xl text-amber anim-glow">
                  {state.playerCount}
                </div>
                <div className="text-muted">players ready</div>
              </div>
            )}
            {(state?.phase === "question" || state?.phase === "reveal") && state.question && (
              <div>
                <div className="flex items-center justify-between gap-3 text-sm uppercase tracking-wider text-muted">
                  <span>
                    Question {state.questionIndex + 1} / {state.questionTotal}
                  </span>
                  <span>{state.answerCount} answered</span>
                </div>

                {state.phase === "question" && (
                  <div className="mt-4">
                    <CountdownTimer
                      remainingSec={remaining}
                      totalSec={state.timeLimitSec}
                      size="lg"
                    />
                  </div>
                )}

                <h2 className="display mt-6 text-3xl leading-tight md:text-5xl">
                  {state.question.prompt}
                </h2>
                <ol className="mt-6 grid gap-3 md:grid-cols-2">
                  {state.question.options.map((opt, i) => {
                    const reveal = state.phase === "reveal";
                    const correct = reveal && state.question?.correctIndex === i;
                    return (
                      <li
                        key={i}
                        className={`rounded-xl border px-4 py-4 text-lg md:text-xl ${
                          correct
                            ? "border-good bg-good/15 text-good"
                            : "border-line bg-ink-2/50"
                        }`}
                      >
                        <span className="mr-2 text-muted">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                      </li>
                    );
                  })}
                </ol>
                {state.phase === "question" && (
                  <p className="mt-4 text-sm text-muted">
                    Timer locks answers automatically at zero. One guess per player.
                  </p>
                )}
              </div>
            )}
            {state?.phase === "finished" && (
              <div className="text-center">
                <div className="text-sm uppercase tracking-[0.2em] text-muted">Winner</div>
                <h2 className="display mt-3 text-6xl text-amber">
                  {state.winner?.name || "No players"}
                </h2>
                {state.winner && (
                  <p className="mt-3 text-2xl text-chalk">{state.winner.totalScore} pts</p>
                )}
              </div>
            )}
          </section>

          <section className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "80ms" }}>
            <h2 className="display text-2xl">Live board</h2>
            <ol className="mt-4 space-y-2">
              {top.length === 0 && <li className="text-muted">No scores yet</li>}
              {top.map((row, i) => (
                <li
                  key={row.playerId}
                  className="flex items-center justify-between rounded-xl border border-line bg-ink-2/40 px-3 py-2"
                >
                  <span className="flex items-center gap-3">
                    <span className="display w-6 text-amber">{i + 1}</span>
                    <span>{row.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{row.totalScore}</span>
                </li>
              ))}
            </ol>
          </section>
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
