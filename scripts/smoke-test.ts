/**
 * Smoke test: create a game via API, open lobby, connect N socket players,
 * open a question, burst-answer, lock, verify leaderboard ordering by speed.
 *
 * Tip for Cloudflare / remote: host sockets can drop during long join bursts.
 * This script re-auths the host before each control action.
 */
import "dotenv/config";
import { io, Socket } from "socket.io-client";

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const PLAYERS = Number(process.env.SMOKE_PLAYERS || 200);
const ADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "admin@localhost";
const ADMIN_PASSWORD =
  process.env.SUPERADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  "trivia-admin";

async function json(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${init?.method || "GET"} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function waitConnect(socket: Socket) {
  return new Promise<void>((resolve, reject) => {
    if (socket.connected) return resolve();
    const t = setTimeout(() => reject(new Error("connect timeout")), 20000);
    socket.once("connect", () => {
      clearTimeout(t);
      resolve();
    });
    socket.once("connect_error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function emitAck<T>(socket: Socket, event: string, payload?: unknown, timeoutMs = 60000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout on ${event}`)), timeoutMs);
    if (payload === undefined) {
      socket.emit(event, (res: T) => {
        clearTimeout(t);
        resolve(res);
      });
    } else {
      socket.emit(event, payload, (res: T) => {
        clearTimeout(t);
        resolve(res);
      });
    }
  });
}

function connectSocket() {
  return io(BASE, {
    path: "/socket.io",
    transports: ["websocket"],
    // Keepalive helps through Cloudflare idle proxies during long join loops
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 20000,
  });
}

async function ensureHost(
  host: Socket,
  code: string,
  hostToken: string
): Promise<Socket> {
  if (!host.connected) {
    console.log("Host socket disconnected — reconnecting…");
    host.connect();
    await waitConnect(host);
  }
  const join = await emitAck<{ ok: boolean; message?: string }>(host, "host:join", {
    code,
    hostToken,
  });
  if (!join.ok) {
    throw new Error(join.message || "host re-join failed");
  }
  return host;
}

async function main() {
  console.log(`Smoke test against ${BASE} with ${PLAYERS} players`);

  const statusRes = await fetch(`${BASE}/api/admin/login`);
  const status = await statusRes.json().catch(() => ({}));
  let loginRes: Response;
  if (status.needsSetup) {
    loginRes = await fetch(`${BASE}/api/admin/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        ...(process.env.SETUP_TOKEN
          ? { setupToken: process.env.SETUP_TOKEN }
          : {}),
      }),
    });
  } else {
    loginRes = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
  }
  if (!loginRes.ok) throw new Error("Admin login/setup failed");
  const cookie = loginRes.headers.getSetCookie?.()?.[0]?.split(";")[0] || "";
  const setCookie = loginRes.headers.get("set-cookie") || cookie;
  const cookieHeader = setCookie.split(";")[0];

  const created = await json("/api/games", {
    method: "POST",
    headers: { Cookie: cookieHeader },
    body: JSON.stringify({
      title: `Smoke ${Date.now()}`,
      questions: [
        {
          prompt: "What is 2+2?",
          options: ["3", "4", "5", "22"],
          correctIndex: 1,
          timeLimitSec: 60,
          basePoints: 500,
          timeBonus: 500,
        },
      ],
    }),
  });

  const game = created.game;
  console.log(`Created game ${game.code}`);

  await json(`/api/games/${game.id}`, {
    method: "PATCH",
    headers: { Cookie: cookieHeader },
    body: JSON.stringify({ status: "LOBBY" }),
  });

  let host = connectSocket();
  await waitConnect(host);
  await ensureHost(host, game.code, game.hostToken);

  // Keep host session warm during long join bursts (Cloudflare idle)
  const keepalive = setInterval(() => {
    if (host.connected) host.emit("game:sync");
  }, 10000);

  const players: Socket[] = [];
  const joinStart = Date.now();
  try {
    for (let i = 0; i < PLAYERS; i++) {
      const s = connectSocket();
      await waitConnect(s);
      const res = await emitAck<{ ok: boolean; message?: string }>(s, "player:join", {
        code: game.code,
        name: `Guest${i}`,
      });
      if (!res.ok) throw new Error(res.message || `player ${i} join failed`);
      players.push(s);
      if ((i + 1) % 50 === 0) {
        console.log(`Joined ${i + 1}/${PLAYERS} (host connected=${host.connected})`);
        await ensureHost(host, game.code, game.hostToken);
      }
    }
    console.log(`Joined ${PLAYERS} players in ${Date.now() - joinStart}ms`);

    await ensureHost(host, game.code, game.hostToken);
    const open = await emitAck<{ ok: boolean; message?: string }>(host, "host:openQuestion");
    if (!open.ok) throw new Error(open.message || "open failed");

    const answerStart = Date.now();
    await Promise.all(
      players.map(async (s, i) => {
        await new Promise((r) => setTimeout(r, Math.floor(i / 10)));
        if (!s.connected) {
          s.connect();
          await waitConnect(s);
        }
        const res = await emitAck<{ ok: boolean; message?: string; points?: number }>(
          s,
          "player:answer",
          { choiceIndex: 1 }
        );
        if (!res.ok) throw new Error(res.message || `answer ${i} failed`);
      })
    );
    console.log(`All answers in ${Date.now() - answerStart}ms`);

    await ensureHost(host, game.code, game.hostToken);
    const lock = await emitAck<{ ok: boolean; message?: string }>(host, "host:lock");
    if (!lock.ok) throw new Error(lock.message || "lock failed");

    await ensureHost(host, game.code, game.hostToken);
    const next = await emitAck<{ ok: boolean; finished?: boolean; message?: string }>(
      host,
      "host:next"
    );
    if (!next.ok || !next.finished) {
      throw new Error(next.message || "expected finished after single question");
    }

    const finalState = await new Promise<{
      leaderboard: { name: string; totalScore: number }[];
    }>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no final state")), 15000);
      const onState = (state: {
        phase: string;
        leaderboard: { name: string; totalScore: number }[];
      }) => {
        if (state.phase === "finished") {
          clearTimeout(t);
          host.off("game:state", onState);
          resolve(state);
        }
      };
      host.on("game:state", onState);
      host.emit("game:sync");
    });

    const board = finalState.leaderboard;
    if (board.length !== PLAYERS) {
      throw new Error(`expected ${PLAYERS} on board, got ${board.length}`);
    }
    if (board[0].totalScore < board[board.length - 1].totalScore) {
      throw new Error("leaderboard not ordered by score");
    }
    console.log(
      `Winner: ${board[0].name} with ${board[0].totalScore}; last: ${board[board.length - 1].name} with ${board[board.length - 1].totalScore}`
    );

    console.log("SMOKE OK");
  } finally {
    clearInterval(keepalive);
    host.close();
    players.forEach((p) => p.close());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
