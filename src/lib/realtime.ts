import type { Server } from "socket.io";

const g = globalThis as unknown as { __triviaIo?: Server };

export function setSocketServer(io: Server) {
  g.__triviaIo = io;
}

export function getSocketServer(): Server | undefined {
  return g.__triviaIo;
}
