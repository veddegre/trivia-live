"use client";

import { io, Socket } from "socket.io-client";
import type { GamePublicState, PlayerView } from "./types";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
  socket = io(url, {
    path: "/socket.io",
    autoConnect: true,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export type ServerToClientEvents = {
  "game:state": (state: GamePublicState) => void;
  "player:state": (player: PlayerView) => void;
  error: (payload: { message: string }) => void;
};
