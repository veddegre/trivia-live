import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { safeEqualString } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildPlayerView,
  buildPlayerViews,
  buildPublicState,
  clearQuestionTimer,
  finishGame,
  kickPlayer,
  lockQuestion,
  markBroadcast,
  nextQuestion,
  openLobby,
  extendQuestion,
  findOrCreateTeam,
  openQuestion,
  pauseQuestion,
  recoverOpenQuestions,
  resetGame,
  resumeQuestion,
  scheduleQuestionAutoLockMs,
  shouldThrottleBroadcast,
  startQuestionClock,
  skipQuestion,
  submitAnswer,
  voidQuestion,
  withoutQuestionMedia,
} from "@/lib/game-manager";
import { assertDisplayName } from "@/lib/display-name";
import { isNameBanned } from "@/lib/bans";
import { rateLimit } from "@/lib/rate-limit";
import { setSocketServer, emitGameReset } from "@/lib/realtime";
import { secretToken } from "@/lib/secret-token";
import { forSpectator } from "@/lib/spectator-state";
import { visiblePuzzleText } from "@/lib/text-reveal";
import { gameTypeUsesRevealText, type GamePublicState } from "@/lib/types";

type JoinHostPayload = { code: string; hostToken: string };
type JoinPlayerPayload = { code: string; name: string; teamName?: string };
type ReconnectPayload = { code: string; token: string };
type AnswerPayload = { choiceIndex?: number; text?: string; wager?: number };

type SocketData = {
  role?: "host" | "player" | "spectator";
  code?: string;
  playerId?: string;
  playerToken?: string;
};

function room(code: string) {
  return `game:${code.toUpperCase()}`;
}

function stateForSocket(
  role: SocketData["role"],
  full: Awaited<ReturnType<typeof buildPublicState>>
) {
  if (!full) return null;
  if (role === "host") return full;
  if (role === "spectator") return forSpectator(full);
  return withoutQuestionMedia(full);
}

/**
 * Venue wifi is one public IP, so the IP ceilings sit at a full room.
 * Per-socket limits stop a single connection from looping.
 */
const SOCKET_LIMITS = {
  join: {
    socket: { limit: 10, windowMs: 60_000 },
    ip: { limit: 240, windowMs: 120_000 },
  },
  answer: {
    socket: { limit: 12, windowMs: 10_000 },
    ip: { limit: 500, windowMs: 10_000 },
  },
  watch: {
    socket: { limit: 10, windowMs: 60_000 },
    ip: { limit: 30, windowMs: 60_000 },
  },
  reconnect: {
    socket: { limit: 20, windowMs: 60_000 },
    ip: { limit: 400, windowMs: 60_000 },
  },
} as const;

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return value?.trim() || "";
}

function socketIp(socket: Socket): string {
  const headers = socket.handshake.headers;
  const cf = headerValue(headers["cf-connecting-ip"]);
  if (cf) return cf;
  const real = headerValue(headers["x-real-ip"]);
  if (real) return real;
  const forwarded = headerValue(headers["x-forwarded-for"]);
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return socket.handshake.address || "unknown";
}

function tooFast(
  socket: Socket,
  action: keyof typeof SOCKET_LIMITS,
  ack?: (r: unknown) => void
): boolean {
  const rule = SOCKET_LIMITS[action];
  const ip = socketIp(socket);
  const bySocket = rateLimit(`socket:${action}:${socket.id}`, rule.socket);
  const byIp = rateLimit(`ip:${action}:${ip}`, rule.ip);
  if (bySocket.ok && byIp.ok) return false;
  ack?.({
    ok: false,
    message: "Too many attempts. Wait a moment and try again.",
  });
  return true;
}

type PuzzleArm = {
  questionId: string;
  openedAt: string;
  pausedAt: string | null;
  timer: ReturnType<typeof setInterval>;
};

const puzzleArms = new Map<string, PuzzleArm>();

function clearPuzzleArm(code: string) {
  const key = code.toUpperCase();
  const arm = puzzleArms.get(key);
  if (!arm) return;
  clearInterval(arm.timer);
  puzzleArms.delete(key);
}

async function emitPuzzleFrame(
  io: Server,
  code: string,
  questionId: string,
  text: string
) {
  const sockets = await io.in(room(code)).fetchSockets();
  for (const s of sockets) {
    const d = s.data as SocketData;
    if (d.role === "spectator") s.emit("puzzle:frame", { questionId, text });
  }
}

/** Push the on-screen puzzle to watch TVs without sending them the solved phrase. */
function syncPuzzleArm(io: Server, state: GamePublicState) {
  const code = state.code.toUpperCase();
  const phrase = state.question?.revealText;
  const questionId = state.question?.id;
  const openedAt = state.questionOpenedAt;
  const live =
    state.phase === "question" &&
    !!phrase &&
    !!questionId &&
    !!openedAt &&
    gameTypeUsesRevealText(state.gameType);
  if (!live || !phrase || !questionId || !openedAt) {
    clearPuzzleArm(code);
    return;
  }
  const existing = puzzleArms.get(code);
  const pausedAt = state.questionPausedAt;
  if (
    existing &&
    existing.questionId === questionId &&
    existing.openedAt === openedAt &&
    existing.pausedAt === pausedAt
  ) {
    return;
  }
  clearPuzzleArm(code);
  const mode = state.gameType === "FINISH_LINE" ? "line" : "unscramble";
  const timeLimitSec = state.timeLimitSec;
  const timer = setInterval(() => {
    const text = visiblePuzzleText({
      text: phrase,
      mode,
      seed: questionId,
      openedAt,
      timeLimitSec,
      now: pausedAt ? new Date(pausedAt).getTime() : Date.now(),
    });
    void emitPuzzleFrame(io, code, questionId, text);
  }, 200);
  puzzleArms.set(code, { questionId, openedAt, pausedAt, timer });
}

/** Origins allowed for browser Socket.io (Cloudflare hostname + local dev). */
function socketCorsOrigin():
  | boolean
  | ((
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void
    ) => void) {
  const allowed = new Set<string>();
  const pub = process.env.NEXT_PUBLIC_PUBLIC_URL?.trim();
  if (pub) {
    try {
      const u = new URL(pub);
      allowed.add(u.origin);
      if (u.hostname.startsWith("www.")) {
        allowed.add(`${u.protocol}//${u.hostname.slice(4)}`);
      } else if (u.hostname.includes(".")) {
        allowed.add(`${u.protocol}//www.${u.hostname}`);
      }
    } catch {
      /* ignore bad URL */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  // Misconfigured prod with no PUBLIC_URL: keep working rather than lock everyone out
  if (allowed.size === 0) return true;

  return (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    cb(null, allowed.has(origin));
  };
}

async function broadcastState(io: Server, code: string, force = false) {
  if (!force && shouldThrottleBroadcast(code)) return;
  markBroadcast(code);
  const state = await buildPublicState(code);
  if (!state) {
    clearPuzzleArm(code);
    return;
  }
  syncPuzzleArm(io, state);
  const sockets = await io.in(room(code)).fetchSockets();
  for (const s of sockets) {
    const d = s.data as SocketData;
    const payload = stateForSocket(d.role, state);
    if (payload) s.emit("game:state", payload);
  }
}

async function emitPlayer(socket: Socket, code: string, playerId: string) {
  const view = await buildPlayerView(code, playerId);
  if (view) socket.emit("player:state", view);
}

async function refreshPlayers(io: Server, code: string) {
  const sockets = await io.in(room(code)).fetchSockets();
  const players = sockets.filter((s) => {
    const d = s.data as SocketData;
    return d.role === "player" && !!d.playerId;
  });
  if (players.length === 0) return;
  const views = await buildPlayerViews(code);
  for (const s of players) {
    const view = views.get((s.data as SocketData).playerId!);
    if (view) s.emit("player:state", view);
  }
}

/**
 * One full board update after an answer burst, not one per tap.
 * Further taps during that update schedule a single follow-up.
 */
const answerBroadcasts = new Map<string, { dirty: boolean }>();

function scheduleAnswerBroadcast(io: Server, code: string) {
  const key = code.toUpperCase();
  const existing = answerBroadcasts.get(key);
  if (existing) {
    existing.dirty = true;
    return;
  }
  const pending = { dirty: false };
  answerBroadcasts.set(key, pending);
  setTimeout(() => {
    void (async () => {
      pending.dirty = false;
      try {
        await broadcastState(io, key, true);
      } finally {
        const follow = pending.dirty;
        answerBroadcasts.delete(key);
        if (follow) scheduleAnswerBroadcast(io, key);
      }
    })();
  }, 300);
}

async function autoLockAndBroadcast(io: Server, code: string) {
  try {
    const result = await lockQuestion(code, { auto: true });
    if (!result.locked) return;
    await broadcastState(io, code, true);
    await refreshPlayers(io, code);
  } catch {
    /* already locked or game gone */
  }
}

function armQuestionTimer(
  io: Server,
  code: string,
  timeLimitSec: number
) {
  armQuestionTimerMs(io, code, timeLimitSec * 1000);
}

function armQuestionTimerMs(io: Server, code: string, delayMs: number) {
  scheduleQuestionAutoLockMs(code, delayMs, () => {
    void autoLockAndBroadcast(io, code);
  });
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: socketCorsOrigin(), credentials: true },
  });
  setSocketServer(io);

  void recoverOpenQuestions((code, remainingMs) => {
    scheduleQuestionAutoLockMs(code, remainingMs, () => {
      void autoLockAndBroadcast(io, code);
    });
  })
    .then((summary) => {
        if (summary.locked || summary.armed || summary.waiting || summary.paused) {
        console.log(
          `Recovered open questions: locked ${summary.locked}, re-armed ${summary.armed}, waiting for play ${summary.waiting}, paused ${summary.paused}`
        );
      }
    })
    .catch((err) => {
      console.error("Failed to recover open questions", err);
    });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on("host:join", async (payload: JoinHostPayload, ack?: (r: unknown) => void) => {
      try {
        const code = payload.code?.toUpperCase();
        const game = await prisma.game.findUnique({ where: { code } });
        const token = (payload.hostToken || "").trim();
        if (!game || !token || !safeEqualString(token, game.hostToken)) {
          throw new Error(
            "This host link is outdated (the game may have been reset). Open Host screen again from Admin."
          );
        }
        if (data.code && data.code !== code) {
          await socket.leave(room(data.code));
        }
        data.role = "host";
        data.code = code;
        await socket.join(room(code));
        if (game.status === "DRAFT") {
          await openLobby(code);
        }
        const state = await buildPublicState(code);
        ack?.({ ok: true, state });
        socket.emit("game:state", state);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Join failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("watch:join", async (payload: { code?: string }, ack?: (r: unknown) => void) => {
      try {
        if (tooFast(socket, "watch", ack)) return;
        const code = payload.code?.toUpperCase();
        if (!code) throw new Error("Game not found");
        const game = await prisma.game.findUnique({
          where: { code },
          select: { id: true },
        });
        if (!game) {
          throw new Error(
            "Game not found — that join code is no longer active. Ask the host for the current watch link."
          );
        }
        if (data.code && data.code !== code) {
          await socket.leave(room(data.code));
        }
        data.role = "spectator";
        data.code = code;
        data.playerId = undefined;
        data.playerToken = undefined;
        await socket.join(room(code));
        const full = await buildPublicState(code);
        const state = stateForSocket("spectator", full);
        ack?.({ ok: true, state });
        if (state) socket.emit("game:state", state);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Join failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("player:join", async (payload: JoinPlayerPayload, ack?: (r: unknown) => void) => {
      try {
        if (tooFast(socket, "join", ack)) return;
        const code = payload.code?.toUpperCase();
        const name = assertDisplayName(payload.name || "");

        const game = await prisma.game.findUnique({
          where: { code },
          include: { players: true },
        });
        if (!game) {
          throw new Error(
            "Game not found — that join code is no longer active. Scan the current QR or ask the host for the new code."
          );
        }
        if (game.status === "DRAFT") {
          throw new Error("Game has not started yet — wait for the host to open the lobby");
        }
        if (game.status === "FINISHED") {
          throw new Error("Game is finished — ask the host to hit Play again");
        }
        if (!game.allowLateJoin && game.status !== "LOBBY") {
          throw new Error("This game isn’t accepting late joins");
        }
        if (isNameBanned(game.bannedNames, name)) {
          throw new Error(
            "That name is blocked for this game — pick another"
          );
        }
        if (game.players.length >= 200) throw new Error("Game is full");

        const existing = game.players.find(
          (p) => p.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) throw new Error("Name already taken — pick another");

        let teamId: string | undefined;
        if (game.teamMode) {
          const teamName = assertDisplayName(payload.teamName || "");
          const team = await findOrCreateTeam(game.id, teamName);
          teamId = team.id;
        }

        const player = await prisma.player.create({
          data: { gameId: game.id, name, token: secretToken(), teamId },
        });

        data.role = "player";
        data.code = code;
        data.playerId = player.id;
        data.playerToken = player.token;
        await socket.join(room(code));

        const full = await buildPublicState(code);
        if (!full) throw new Error("Game not found");
        const state = withoutQuestionMedia(full);
        const view = await buildPlayerView(code, player.id);
        ack?.({ ok: true, player: view, state });
        socket.emit("player:state", view);
        await broadcastState(io, code, true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Join failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("player:reconnect", async (payload: ReconnectPayload, ack?: (r: unknown) => void) => {
      try {
        if (tooFast(socket, "reconnect", ack)) return;
        const code = payload.code?.toUpperCase();
        const player = await prisma.player.findFirst({
          where: { token: payload.token, game: { code } },
        });
        if (!player) throw new Error("Session not found");

        data.role = "player";
        data.code = code;
        data.playerId = player.id;
        data.playerToken = player.token;
        await socket.join(room(code));

        const full = await buildPublicState(code);
        if (!full) throw new Error("Game not found");
        const state = withoutQuestionMedia(full);
        const view = await buildPlayerView(code, player.id);
        ack?.({ ok: true, player: view, state });
        socket.emit("player:state", view);
        socket.emit("game:state", state);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Reconnect failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:start", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        await openLobby(data.code);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:openQuestion", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const opened = await openQuestion(data.code);
        if (!opened.deferClock) {
          armQuestionTimer(io, data.code, opened.timeLimitSec);
        }
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
        void refreshPlayers(io, data.code);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:startClock", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const started = await startQuestionClock(data.code);
        if (!started.alreadyStarted) {
          armQuestionTimer(io, data.code, started.timeLimitSec);
        }
        await broadcastState(io, data.code, true);
        ack?.({
          ok: true,
          openedAt: started.openedAt.toISOString(),
          alreadyStarted: started.alreadyStarted,
        });
        void refreshPlayers(io, data.code);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:pause", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        await pauseQuestion(data.code);
        clearQuestionTimer(data.code);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:resume", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const resumed = await resumeQuestion(data.code);
        armQuestionTimerMs(io, data.code, resumed.remainingMs);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:extend", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const extended = await extendQuestion(data.code);
        if (!extended.paused) armQuestionTimerMs(io, data.code, extended.remainingMs);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:lock", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        clearQuestionTimer(data.code);
        await lockQuestion(data.code);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
        void refreshPlayers(io, data.code);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:next", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const result = await nextQuestion(data.code);
        clearQuestionTimer(data.code);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true, ...result });
        void refreshPlayers(io, data.code);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:void", async (payload: { mode?: "zero" | "credit" } | undefined, ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const mode = payload?.mode === "credit" ? "credit" : "zero";
        clearQuestionTimer(data.code);
        await voidQuestion(data.code, mode);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
        void refreshPlayers(io, data.code);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:skip", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        clearQuestionTimer(data.code);
        const result = await skipQuestion(data.code);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true, ...result });
        void refreshPlayers(io, data.code);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:finish", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        clearQuestionTimer(data.code);
        await finishGame(data.code);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:kick", async (payload: { playerId?: string }, ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const playerId = payload?.playerId?.trim();
        if (!playerId) throw new Error("Player is required");
        const kicked = await kickPlayer(data.code, playerId);
        const sockets = await io.in(room(data.code)).fetchSockets();
        for (const s of sockets) {
          const d = s.data as SocketData;
          if (d.role === "player" && d.playerId === kicked.playerId) {
            s.emit("player:kicked", {
              message:
                "The host removed you from the game. You can’t rejoin with that name tonight.",
            });
            d.role = undefined;
            d.playerId = undefined;
            d.playerToken = undefined;
            await s.leave(room(data.code));
          }
        }
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("host:reset", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const existing = await prisma.game.findUnique({ where: { code: data.code } });
        if (!existing) throw new Error("Game not found");
        const previousCode = data.code;
        clearPuzzleArm(previousCode);
        const { game } = await resetGame(existing.id);
        if (!game) throw new Error("Reset failed");

        await emitGameReset(io, previousCode, {
          code: game.code,
          hostToken: game.hostToken,
        });
        data.code = game.code;
        await socket.leave(room(previousCode));
        await socket.join(room(game.code));
        await broadcastState(io, game.code, true);
        // Ack includes hostToken only for the host socket that triggered reset
        ack?.({
          ok: true,
          previousCode,
          code: game.code,
          hostToken: game.hostToken,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("player:answer", async (payload: AnswerPayload, ack?: (r: unknown) => void) => {
      try {
        if (tooFast(socket, "answer", ack)) return;
        if (data.role !== "player" || !data.code || !data.playerToken || !data.playerId) {
          throw new Error("Not authorized");
        }
        const result = await submitAnswer({
          code: data.code,
          playerToken: data.playerToken,
          choiceIndex: payload.choiceIndex,
          text: payload.text,
          wager: payload.wager,
        });
        await emitPlayer(socket, data.code, data.playerId);
        if (result.team) await refreshPlayers(io, data.code);
        scheduleAnswerBroadcast(io, data.code);
        ack?.({ ok: true, ...result });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Answer failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("game:sync", async (ack?: (r: unknown) => void) => {
      try {
        if (!data.code) throw new Error("Not in a game");
        const full = await buildPublicState(data.code);
        if (!full) throw new Error("Game not found");
        const state = stateForSocket(data.role, full);
        socket.emit("game:state", state);
        if (data.playerId) await emitPlayer(socket, data.code, data.playerId);
        ack?.({ ok: true, state });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Sync failed";
        ack?.({ ok: false, message });
      }
    });
  });

  return io;
}
