import type { Server } from "socket.io";

const g = globalThis as unknown as { __triviaIo?: Server };

export function setSocketServer(io: Server) {
  g.__triviaIo = io;
}

export function getSocketServer(): Server | undefined {
  return g.__triviaIo;
}

type SocketData = {
  role?: "host" | "player";
};

/**
 * Notify a room that a game was reset.
 * Players only get codes; host sockets additionally get hostToken.
 */
export async function emitGameReset(
  io: Server,
  previousCode: string,
  next: { code: string; hostToken: string }
) {
  const publicPayload = {
    previousCode,
    code: next.code,
  };
  const sockets = await io.in(`game:${previousCode}`).fetchSockets();
  await Promise.all(
    sockets.map(async (s) => {
      const role = (s.data as SocketData).role;
      if (role === "host") {
        s.emit("game:reset", { ...publicPayload, hostToken: next.hostToken });
      } else {
        s.emit("game:reset", publicPayload);
      }
    })
  );
}
