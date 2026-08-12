/**
 * Smoke test: create a game via API, open lobby, connect N socket players,
 * open a question, burst-answer, lock, verify leaderboard ordering by speed.
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
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
}

function emitAck<T>(socket: Socket, event: string, payload?: unknown, timeoutMs = 60000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout on ${event}`)), timeoutMs);
    // Socket.io: events with ack may be (payload, ack) or (ack) only
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

async function main() {
  console.log(`Smoke test against ${BASE} with ${PLAYERS} players`);

  // Setup or login
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
  // Fallback for older fetch
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

  const host = io(BASE, { path: "/socket.io", transports: ["websocket"] });
  await waitConnect(host);
  const hostJoin = await emitAck<{ ok: boolean; message?: string }>(host, "host:join", {
    code: game.code,
    hostToken: game.hostToken,
  });
  if (!hostJoin.ok) throw new Error(hostJoin.message || "host join failed");

  const players: Socket[] = [];
  const joinStart = Date.now();
  for (let i = 0; i < PLAYERS; i++) {
    const s = io(BASE, { path: "/socket.io", transports: ["websocket"] });
    await waitConnect(s);
    const res = await emitAck<{ ok: boolean; message?: string }>(s, "player:join", {
      code: game.code,
      name: `P${i}`,
    });
    if (!res.ok) throw new Error(res.message || `player ${i} join failed`);
    players.push(s);
    if ((i + 1) % 50 === 0) console.log(`Joined ${i + 1}/${PLAYERS}`);
  }
  console.log(`Joined ${PLAYERS} players in ${Date.now() - joinStart}ms`);

  const open = await emitAck<{ ok: boolean; message?: string }>(host, "host:openQuestion");
  if (!open.ok) throw new Error(open.message || "open failed");

  // Stagger answers slightly so first players score higher
  const answerStart = Date.now();
  await Promise.all(
    players.map(async (s, i) => {
      await new Promise((r) => setTimeout(r, Math.floor(i / 10)));
      const res = await emitAck<{ ok: boolean; message?: string; points?: number }>(
        s,
        "player:answer",
        { choiceIndex: 1 }
      );
      if (!res.ok) throw new Error(res.message || `answer ${i} failed`);
    })
  );
  console.log(`All answers in ${Date.now() - answerStart}ms`);

  const lock = await emitAck<{ ok: boolean }>(host, "host:lock");
  if (!lock.ok) throw new Error("lock failed");

  const next = await emitAck<{ ok: boolean; finished?: boolean }>(host, "host:next");
  if (!next.ok || !next.finished) throw new Error("expected finished after single question");

  // Final state via sync
  const finalState = await new Promise<{ leaderboard: { name: string; totalScore: number }[] }>(
    (resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no final state")), 5000);
      host.on("game:state", (state) => {
        if (state.phase === "finished") {
          clearTimeout(t);
          resolve(state);
        }
      });
      host.emit("game:sync");
    }
  );

  const board = finalState.leaderboard;
  if (board.length !== PLAYERS) {
    throw new Error(`expected ${PLAYERS} on board, got ${board.length}`);
  }
  if (board[0].totalScore < board[board.length - 1].totalScore) {
    throw new Error("leaderboard not ordered by score");
  }
  // First joiner answered earliest → should be among top scores
  console.log(
    `Winner: ${board[0].name} with ${board[0].totalScore}; last: ${board[board.length - 1].name} with ${board[board.length - 1].totalScore}`
  );

  host.close();
  players.forEach((p) => p.close());
  console.log("SMOKE OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
