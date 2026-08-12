import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { prisma } from "@/lib/db";
import {
  buildPlayerView,
  buildPublicState,
  clearQuestionTimer,
  finishGame,
  lockQuestion,
  markBroadcast,
  nextQuestion,
  openLobby,
  openQuestion,
  resetGame,
  scheduleQuestionAutoLock,
  shouldThrottleBroadcast,
  submitAnswer,
} from "@/lib/game-manager";
import { setSocketServer, emitGameReset } from "@/lib/realtime";

type JoinHostPayload = { code: string; hostToken: string };
type JoinPlayerPayload = { code: string; name: string };
type ReconnectPayload = { code: string; token: string };
type AnswerPayload = { choiceIndex: number };

type SocketData = {
  role?: "host" | "player";
  code?: string;
  playerId?: string;
  playerToken?: string;
};

function room(code: string) {
  return `game:${code.toUpperCase()}`;
}

async function broadcastState(io: Server, code: string, force = false) {
  if (!force && shouldThrottleBroadcast(code)) return;
  markBroadcast(code);
  const state = await buildPublicState(code);
  if (!state) return;
  io.to(room(code)).emit("game:state", state);
}

async function emitPlayer(socket: Socket, code: string, playerId: string) {
  const view = await buildPlayerView(code, playerId);
  if (view) socket.emit("player:state", view);
}

async function refreshPlayers(io: Server, code: string) {
  const sockets = await io.in(room(code)).fetchSockets();
  await Promise.all(
    sockets.map(async (s) => {
      const d = s.data as SocketData;
      if (d.role === "player" && d.playerId) {
        await emitPlayer(s as unknown as Socket, code, d.playerId);
      }
    })
  );
}

async function autoLockAndBroadcast(io: Server, code: string) {
  try {
    const game = await prisma.game.findUnique({ where: { code: code.toUpperCase() } });
    if (!game || game.status !== "QUESTION") return;
    await lockQuestion(code);
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
  scheduleQuestionAutoLock(code, timeLimitSec, () => {
    void autoLockAndBroadcast(io, code);
  });
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });
  setSocketServer(io);

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on("host:join", async (payload: JoinHostPayload, ack?: (r: unknown) => void) => {
      try {
        const code = payload.code?.toUpperCase();
        const game = await prisma.game.findUnique({ where: { code } });
        if (!game || game.hostToken !== payload.hostToken) {
          throw new Error(
            "This host link is outdated (the game may have been reset). Open Host screen again from Admin."
          );
        }
        data.role = "host";
        data.code = code;
        await socket.join(room(code));
        const state = await buildPublicState(code);
        ack?.({ ok: true, state });
        socket.emit("game:state", state);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Join failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("player:join", async (payload: JoinPlayerPayload, ack?: (r: unknown) => void) => {
      try {
        const code = payload.code?.toUpperCase();
        const name = (payload.name || "").trim().slice(0, 24);
        if (!name) throw new Error("Name is required");

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
        if (game.players.length >= 200) throw new Error("Game is full");

        const existing = game.players.find(
          (p) => p.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) throw new Error("Name already taken — pick another");

        const player = await prisma.player.create({
          data: { gameId: game.id, name },
        });

        data.role = "player";
        data.code = code;
        data.playerId = player.id;
        data.playerToken = player.token;
        await socket.join(room(code));

        const state = await buildPublicState(code);
        const view = await buildPlayerView(code, player.id);
        ack?.({ ok: true, player: view, state });
        socket.emit("player:state", view);
        io.to(room(code)).emit("game:state", state);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Join failed";
        ack?.({ ok: false, message });
        socket.emit("error", { message });
      }
    });

    socket.on("player:reconnect", async (payload: ReconnectPayload, ack?: (r: unknown) => void) => {
      try {
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

        const state = await buildPublicState(code);
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
        armQuestionTimer(io, data.code, opened.timeLimitSec);
        await broadcastState(io, data.code, true);
        ack?.({ ok: true });
        void refreshPlayers(io, data.code);
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

    socket.on("host:reset", async (ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "host" || !data.code) throw new Error("Not authorized");
        const existing = await prisma.game.findUnique({ where: { code: data.code } });
        if (!existing) throw new Error("Game not found");
        const previousCode = data.code;
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
        if (data.role !== "player" || !data.code || !data.playerToken || !data.playerId) {
          throw new Error("Not authorized");
        }
        const result = await submitAnswer({
          code: data.code,
          playerToken: data.playerToken,
          choiceIndex: payload.choiceIndex,
        });
        await emitPlayer(socket, data.code, data.playerId);
        // Throttled live board for host/others
        await broadcastState(io, data.code, false);
        // Always push a light answer-count update eventually
        setTimeout(() => {
          void broadcastState(io, data.code!, true);
        }, 300);
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
        const state = await buildPublicState(data.code);
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
