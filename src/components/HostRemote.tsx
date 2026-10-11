"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrandProvider } from "@/components/BrandProvider";
import { useClockOffset } from "@/hooks/useClockOffset";
import { useQuestionCountdown } from "@/hooks/useQuestionCountdown";
import { readHostToken, storeHostToken } from "@/lib/host-token";
import { getSocket } from "@/lib/socket-client";
import type { BrandConfig } from "@/lib/branding";
import type { GamePublicState, LeaderboardEntry } from "@/lib/types";
import { GAME_TYPE_LABEL, gameTypeUsesAudio } from "@/lib/types";

export function HostRemote({ code }: { code: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [hostToken] = useState(() => {
    const fromQuery = search.get("token")?.trim() || "";
    if (fromQuery) {
      storeHostToken(code, fromQuery);
      return fromQuery;
    }
    return readHostToken(code);
  });
  const [state, setState] = useState<GamePublicState | null>(null);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (search.get("token")) {
      router.replace(`/remote/${encodeURIComponent(code)}`, { scroll: false });
    }
  }, [code, router, search]);

  useEffect(() => {
    if (state?.brand) setBrand(state.brand);
  }, [state?.brand]);

  useEffect(() => {
    if (!hostToken) {
      setError("Missing host token. Open Controls from Admin.");
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
      if (payload.hostToken && payload.code) {
        storeHostToken(payload.code, payload.hostToken);
        router.replace(`/remote/${encodeURIComponent(payload.code)}`);
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

  function emit(event: string, payload?: unknown) {
    const socket = getSocket();
    const done = (res: { ok?: boolean; message?: string }) => {
      if (res && res.ok === false) setError(res.message || "Action failed");
      else setError("");
    };
    if (payload === undefined) socket.emit(event, done);
    else socket.emit(event, payload, done);
  }

  function kick(row: LeaderboardEntry) {
    if (
      !confirm(
        `Remove “${row.name}” from the game?\n\nThey won’t be able to rejoin with that name until Play again.`
      )
    ) {
      return;
    }
    emit("host:kick", { playerId: row.playerId });
  }

  const clockOffsetMs = useClockOffset(state?.serverNow);
  const remaining = useQuestionCountdown(
    state?.questionOpenedAt,
    state?.timeLimitSec,
    state?.phase === "question",
    clockOffsetMs,
    state?.questionPausedAt,
    state?.questionExtraMs ?? 0
  );
  const phase = state?.phase;
  const clockRunning = phase === "question" && !!state?.questionOpenedAt;
  const questionLabel = state
    ? `Question ${state.questionIndex + 1} of ${state.questionTotal}`
    : "";

  return (
    <BrandProvider brand={brand}>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5">
        <BrandMark href={null} badgeLast size="sm" />
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-amber">
          Controls · {(state?.code || code).toUpperCase()}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-chalk">
          {state?.title || "Connecting…"}
        </h1>
        {state && (
          <p className="mt-1 text-sm text-muted">
            {GAME_TYPE_LABEL[state.gameType]}
            {phase === "lobby" || phase === "question" || phase === "reveal" || phase === "between"
              ? ` · ${questionLabel}`
              : ""}
            {!connected ? " · reconnecting" : ""}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}

        {state && (
          <div className="mt-6 flex flex-1 flex-col gap-3">
            {phase === "question" && (
              <p className="text-sm font-semibold text-chalk">
                {state.answerCount} / {state.playerCount} answered
              </p>
            )}
            {clockRunning && remaining != null && (
              <p className="text-center text-4xl font-extrabold tabular-nums text-chalk">
                {state.questionPausedAt ? "Paused" : remaining}
                <span className="ml-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                  {state.questionPausedAt ? `${remaining}s left` : "seconds"}
                </span>
              </p>
            )}
            {clockRunning && (
              <>
                <RemoteButton
                  onClick={() => emit(state.questionPausedAt ? "host:resume" : "host:pause")}
                >
                  {state.questionPausedAt ? "Resume" : "Pause"}
                </RemoteButton>
                <RemoteButton tone="ghost" onClick={() => emit("host:extend")}>
                  Add 10 seconds
                </RemoteButton>
              </>
            )}
            {phase === "question" &&
              gameTypeUsesAudio(state.gameType) &&
              !state.questionOpenedAt && (
                <p className="text-sm text-muted">
                  Tap Play on the big screen to start the music and the clock.
                </p>
              )}

            {state.status === "DRAFT" && (
              <RemoteButton onClick={() => emit("host:start")}>Open lobby</RemoteButton>
            )}
            {(phase === "lobby" || phase === "between") && state.status !== "DRAFT" && (
              <RemoteButton onClick={() => emit("host:openQuestion")}>
                {phase === "between"
                  ? `Start question ${state.questionIndex + 1}`
                  : `Start question ${state.questionIndex + 1}`}
              </RemoteButton>
            )}
            {phase === "question" && (
              <RemoteButton onClick={() => emit("host:lock")}>Lock now</RemoteButton>
            )}
            {phase === "reveal" && (
              <RemoteButton onClick={() => emit("host:next")}>
                {state.questionIndex + 1 >= state.questionTotal ? "Show winner" : "Continue"}
              </RemoteButton>
            )}
            {(phase === "question" || phase === "reveal") && (
              <>
                <RemoteButton
                  tone="ghost"
                  onClick={() => {
                    if (confirm("Skip this question? Nobody keeps points for it.")) {
                      emit("host:skip");
                    }
                  }}
                >
                  Skip question
                </RemoteButton>
                <RemoteButton
                  tone="ghost"
                  onClick={() => {
                    if (confirm("Void this question? Scores for it drop to zero.")) {
                      emit("host:void", { mode: "zero" });
                    }
                  }}
                >
                  Void · zero points
                </RemoteButton>
                <RemoteButton
                  tone="ghost"
                  onClick={() => {
                    if (
                      confirm(
                        "Credit everyone for this question? Each player gets a correct answer at base points."
                      )
                    ) {
                      emit("host:void", { mode: "credit" });
                    }
                  }}
                >
                  Void · credit everyone
                </RemoteButton>
              </>
            )}
            {phase !== "finished" && state.status !== "DRAFT" && (
              <RemoteButton
                tone="ghost"
                onClick={() => {
                  if (confirm("End the game now?")) emit("host:finish");
                }}
              >
                End game
              </RemoteButton>
            )}
            {phase === "finished" && (
              <RemoteButton
                onClick={() => {
                  if (
                    confirm(
                      "Play again? This clears players and scores, keeps the questions, and issues a new join code."
                    )
                  ) {
                    emit("host:reset");
                  }
                }}
              >
                Play again
              </RemoteButton>
            )}

            <section className="mt-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                Players · {state.playerCount}
              </h2>
              <ul className="mt-3 space-y-2">
                {state.leaderboard.length === 0 && (
                  <li className="text-sm italic text-muted">Waiting for players…</li>
                )}
                {state.leaderboard.map((row) => (
                  <li
                    key={row.playerId}
                    className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-chalk">
                      {row.name}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-amber">
                      {row.totalScore.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-muted hover:text-bad"
                      onClick={() => kick(row)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </BrandProvider>
  );
}

function RemoteButton({
  children,
  onClick,
  tone = "primary",
}: {
  children: string;
  onClick: () => void;
  tone?: "primary" | "ghost";
}) {
  const primary = tone === "primary";
  return (
    <button
      type="button"
      className={`w-full rounded-2xl py-4 text-sm font-extrabold uppercase tracking-[0.12em] ${
        primary ? "" : "border border-line bg-transparent text-chalk"
      }`}
      style={
        primary
          ? { background: "var(--amber)", color: "#1a1200" }
          : undefined
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}
