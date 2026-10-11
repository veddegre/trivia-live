/**
 * Live functional check against a running Trivia Live server.
 * Creates short nights, plays every question type, then deletes those games.
 * Finished nights stay in History (there is no API to remove them).
 *
 *   SUPERADMIN_EMAIL=… SUPERADMIN_PASSWORD=… npm run live
 *   LIVE_BASE_URL=http://127.0.0.1:3000 npm run live
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { io, Socket } from "socket.io-client";

const BASE = process.env.LIVE_BASE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const ADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
const POINTS = 100;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

type Ack = { ok: boolean; message?: string; finished?: boolean; player?: { playerId: string } };
type BoardRow = { name: string; totalScore: number; lastPoints?: number };
type LiveQuestion = {
  gameType: string;
  options: string[];
  typed?: boolean;
  closest?: boolean;
  wager?: boolean;
  imageUrl: string | null;
  audioUrl: string | null;
  revealText?: string;
};
type LiveState = {
  phase: string;
  gameType: string;
  mixedTypes: boolean;
  questionOpenedAt: string | null;
  questionPausedAt: string | null;
  questionExtraMs: number;
  teamMode: boolean;
  teamCount: number;
  roster: { name: string }[];
  leaderboard: BoardRow[];
  question: LiveQuestion | null;
};

const gameIds: string[] = [];
let bankId = "";
let seasonId = "";
let authCookie = "";
const sockets: Socket[] = [];
let stepName = "start";

function step(name: string) {
  stepName = name;
  console.log(`— ${name}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asFile(name: string, type: string, bytes: Buffer) {
  const copy = Uint8Array.from(bytes);
  return new File([copy], name, { type });
}

function wavSilence() {
  const samples = 800;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

function connectSocket() {
  const socket = io(BASE, {
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: false,
    timeout: 20000,
  });
  sockets.push(socket);
  return socket;
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

function emitAck<T>(socket: Socket, event: string, payload?: unknown, timeoutMs = 20000) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout on ${event}`)), timeoutMs);
    const done = (res: T) => {
      clearTimeout(t);
      resolve(res);
    };
    if (payload === undefined) socket.emit(event, done);
    else socket.emit(event, payload, done);
  });
}

async function mustAck(socket: Socket, event: string, payload?: unknown) {
  const res = await emitAck<Ack>(socket, event, payload);
  if (!res.ok) throw new Error(res.message || `${event} failed`);
  return res;
}

async function sync(socket: Socket) {
  const res = await emitAck<{ ok: boolean; message?: string; state: LiveState }>(
    socket,
    "game:sync"
  );
  if (!res.ok || !res.state) throw new Error(res.message || "sync failed");
  return res.state;
}

function row(state: LiveState, name: string) {
  const found = state.leaderboard.find((entry) => entry.name === name);
  if (!found) throw new Error(`missing leaderboard row ${name}`);
  return found;
}

function q(prompt: string, extra: Record<string, unknown> = {}) {
  return {
    prompt,
    options: ["Yes", "No"],
    correctIndex: 0,
    timeLimitSec: 60,
    basePoints: POINTS,
    timeBonus: 0,
    ...extra,
  };
}

async function api(path: string, cookie: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cookie", cookie);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new Error(`${init?.method || "GET"} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return body;
}

async function upload(cookie: string, name: string, type: string, bytes: Buffer, kind?: string) {
  const form = new FormData();
  form.set("file", asFile(name, type, bytes), name);
  if (kind) form.set("kind", kind);
  const body = await api("/api/uploads", cookie, { method: "POST", body: form });
  const key = body.key;
  if (typeof key !== "string" || !key) throw new Error("upload did not return a key");
  return key;
}

async function playChoice(
  host: Socket,
  ada: Socket,
  ben: Socket,
  watch: Socket,
  label: string,
  adaName: string,
  benName: string,
  adaTotal: number,
  benTotal: number,
  opts: {
    audio?: boolean;
    image?: boolean;
    puzzle?: boolean;
    typed?: boolean;
    closest?: boolean;
    pause?: boolean;
    adaAnswer: Record<string, unknown>;
    benAnswer: Record<string, unknown>;
    adaPoints: number;
    benPoints: number;
  }
) {
  step(label);
  await sleep(1500);
  await mustAck(host, "host:openQuestion");
  let state = await sync(host);
  assert.equal(state.phase, "question");
  assert.equal(state.gameType, state.question?.gameType);
  assert.equal(state.mixedTypes, true);
  if (opts.audio) {
    assert.equal(state.questionOpenedAt, null);
    assert.ok(state.question?.audioUrl);
    const early = await emitAck<Ack>(ada, "player:answer", opts.adaAnswer);
    assert.equal(early.ok, false);
    assert.match(early.message || "", /music/);
    await mustAck(host, "host:startClock");
    state = await sync(host);
    assert.ok(state.questionOpenedAt);
  }
  if (opts.image) {
    assert.ok(state.question?.imageUrl);
    const phone = await sync(ada);
    assert.equal(phone.question?.imageUrl, null);
    const spectator = await sync(watch);
    assert.ok(spectator.question?.imageUrl);
  }
  if (opts.puzzle) {
    assert.ok(state.question?.revealText);
    const phone = await sync(ada);
    assert.equal(phone.question?.revealText, undefined);
  }
  if (opts.typed || opts.closest) {
    assert.deepEqual(state.question?.options, []);
  }
  if (opts.pause) {
    await mustAck(host, "host:pause");
    const paused = await sync(host);
    assert.ok(paused.questionPausedAt);
    const blocked = await emitAck<Ack>(ada, "player:answer", opts.adaAnswer);
    assert.equal(blocked.ok, false);
    assert.match(blocked.message || "", /paused/);
    await mustAck(host, "host:resume");
    await mustAck(host, "host:extend");
    const extended = await sync(host);
    assert.equal(extended.questionPausedAt, null);
    assert.equal(extended.questionExtraMs, 10_000);
    const denied = await emitAck<Ack>(watch, "host:lock");
    assert.equal(denied.ok, false);
  }
  await mustAck(ada, "player:answer", opts.adaAnswer);
  await mustAck(ben, "player:answer", opts.benAnswer);
  await mustAck(host, "host:lock");
  const revealed = await sync(host);
  assert.equal(revealed.phase, "reveal");
  assert.equal(row(revealed, adaName).lastPoints, opts.adaPoints);
  assert.equal(row(revealed, benName).lastPoints, opts.benPoints);
  assert.equal(row(revealed, adaName).totalScore, adaTotal);
  assert.equal(row(revealed, benName).totalScore, benTotal);
  if (opts.typed || opts.closest) {
    assert.ok((revealed.question?.options.length ?? 0) > 0);
  }
  const next = await mustAck(host, "host:next");
  assert.equal(next.finished, false);
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD");
  }
  console.log(`Live suite against ${BASE}`);
  const tag = randomBytes(2).toString("hex");
  const adaName = `Ada${tag}`;
  const benName = `Ben${tag}`;
  const camName = `Cam${tag}`;
  const beaName = `Bea${tag}`;
  const dogs = `Dogs${tag}`;
  const cats = `Cats${tag}`;
  const nightTitle = `Live ${tag}`;
  const teamTitle = `Live teams ${tag}`;

  step("health");
  const healthRes = await fetch(`${BASE}/api/health`);
  const health = (await healthRes.json()) as { ok?: boolean; db?: boolean; uploads?: boolean };
  assert.equal(healthRes.status, 200);
  assert.equal(health.ok, true);
  assert.equal(health.db, true);
  assert.equal(health.uploads, true);

  step("admin login");
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Admin login failed (${loginRes.status})`);
  const setCookies = loginRes.headers.getSetCookie?.() ?? [];
  const session =
    setCookies.find((line) => line.startsWith("trivia_session=")) ||
    loginRes.headers.get("set-cookie") ||
    "";
  const cookie = session.split(";")[0];
  if (!cookie.startsWith("trivia_session=")) throw new Error("Login did not set a session cookie");
  authCookie = cookie;

  step("upload photo and audio");
  const imageKey = await upload(cookie, "dot.png", "image/png", PNG);
  const audioKey = await upload(cookie, "tone.wav", "audio/wav", wavSilence(), "audio");
  const range = await fetch(`${BASE}/api/media/${encodeURIComponent(imageKey)}`, {
    headers: { Range: "bytes=0-15" },
  });
  assert.equal(range.status, 206);
  assert.match(range.headers.get("content-range") || "", /^bytes 0-15\//);

  step("import bank and game pack");
  const bankForm = new FormData();
  const bankName = `Live bank ${tag}.csv`;
  bankForm.set(
    "file",
    asFile(bankName, "text/csv", Buffer.from("prompt,A,B,correct\nLive capital,Paris,London,A\n")),
    bankName
  );
  const importedBank = await api("/api/banks/import", cookie, { method: "POST", body: bankForm });
  const bank = importedBank.bank as { id: string; title: string; questions?: unknown[] };
  bankId = bank.id;
  assert.match(bank.title, /Live bank/);
  const exported = await fetch(`${BASE}/api/banks/${bank.id}/export`, { headers: { Cookie: cookie } });
  assert.equal(exported.status, 200);
  const packJson = (await exported.json()) as { questions: { prompt: string }[] };
  assert.equal(packJson.questions[0]?.prompt, "Live capital");

  const gameForm = new FormData();
  const packName = `live-pack-${tag}.json`;
  gameForm.set(
    "file",
    asFile(
      packName,
      "application/json",
      Buffer.from(
        JSON.stringify({
          version: 1,
          title: `Live pack ${tag}`,
          gameType: "TRIVIA",
          questions: [
            {
              prompt: "Pack question",
              options: ["Yes", "No"],
              correctIndex: 0,
              timeLimitSec: 30,
              basePoints: POINTS,
              timeBonus: 0,
            },
          ],
        })
      )
    ),
    packName
  );
  const importedGame = await api("/api/games/import", cookie, { method: "POST", body: gameForm });
  const packed = importedGame.game as { id: string };
  gameIds.push(packed.id);

  const choice = { choiceIndex: 0 };
  const wrong = { choiceIndex: 1 };
  const media = { imageKey };
  const song = { audioKey };

  step("create mixed night");
  const created = await api("/api/games", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: nightTitle,
      questions: [
        q("Trivia", { gameType: "TRIVIA" }),
        q("Zoom", { gameType: "IMAGE_ZOOM", ...media }),
        q("Finish", { gameType: "PICTURE_FINISH", ...media }),
        q("Shape", { gameType: "SILHOUETTE", ...media }),
        q("Song", { gameType: "AUDIO_SPEED", ...song }),
        q("Backwards", { gameType: "AUDIO_REVERSE", ...song }),
        q("Scramble", { gameType: "UNSCRAMBLE", revealText: "TRIVIA LIVE" }),
        q("Line", { gameType: "FINISH_LINE", revealText: "finish this line" }),
        q("Typed", { gameType: "TRIVIA", typed: true, options: ["Beatles"], correctIndex: 0 }),
        q("Closest", { gameType: "TRIVIA", closest: true, options: ["42"], correctIndex: 0 }),
        q("Credit", { gameType: "TRIVIA" }),
        q("Wager", { gameType: "TRIVIA", wager: true }),
        q("Skip", { gameType: "TRIVIA" }),
      ],
    }),
  });
  const game = created.game as { id: string; code: string; hostToken: string };
  gameIds.push(game.id);

  const host = connectSocket();
  await waitConnect(host);
  await mustAck(host, "host:join", { code: game.code, hostToken: game.hostToken });
  const watch = connectSocket();
  await waitConnect(watch);
  await mustAck(watch, "watch:join", { code: game.code });

  async function join(name: string, teamName?: string) {
    const socket = connectSocket();
    await waitConnect(socket);
    const res = await mustAck(socket, "player:join", {
      code: game.code,
      name,
      ...(teamName ? { teamName } : {}),
    });
    return { socket, playerId: res.player?.playerId || "" };
  }

  step("join and kick");
  const ada = await join(adaName);
  const ben = await join(benName);
  const cam = await join(camName);
  await mustAck(host, "host:kick", { playerId: cam.playerId });
  const banned = await emitAck<Ack>(cam.socket, "player:join", { code: game.code, name: camName });
  assert.equal(banned.ok, false);

  let adaTotal = 0;
  let benTotal = 0;
  const rounds: Array<{
    label: string;
    adaPoints: number;
    benPoints: number;
    opts: Parameters<typeof playChoice>[9];
  }> = [
    {
      label: "trivia pause and +10s",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { pause: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "image zoom",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { image: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "picture finish",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { image: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "silhouette",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { image: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "guess the song",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { audio: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "backwards song",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { audio: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "unscramble",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { puzzle: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "finish the line",
      adaPoints: POINTS,
      benPoints: 0,
      opts: { puzzle: true, adaAnswer: choice, benAnswer: wrong, adaPoints: POINTS, benPoints: 0 },
    },
    {
      label: "typed answer",
      adaPoints: POINTS,
      benPoints: 0,
      opts: {
        typed: true,
        adaAnswer: { text: "the beatles" },
        benAnswer: { text: "nope" },
        adaPoints: POINTS,
        benPoints: 0,
      },
    },
    {
      label: "closest number",
      adaPoints: POINTS,
      benPoints: 0,
      opts: {
        closest: true,
        adaAnswer: { text: "42" },
        benAnswer: { text: "1000" },
        adaPoints: POINTS,
        benPoints: 0,
      },
    },
  ];

  for (const round of rounds) {
    adaTotal += round.adaPoints;
    benTotal += round.benPoints;
    await playChoice(
      host,
      ada.socket,
      ben.socket,
      watch,
      round.label,
      adaName,
      benName,
      adaTotal,
      benTotal,
      round.opts
    );
  }

  step("credit void");
  await sleep(1500);
  await mustAck(host, "host:openQuestion");
  await mustAck(host, "host:void", { mode: "credit" });
  adaTotal += POINTS;
  benTotal += POINTS;
  const credited = await sync(host);
  assert.equal(row(credited, adaName).lastPoints, POINTS);
  assert.equal(row(credited, benName).lastPoints, POINTS);
  assert.equal(row(credited, adaName).totalScore, adaTotal);
  assert.equal(row(credited, benName).totalScore, benTotal);
  assert.equal((await mustAck(host, "host:next")).finished, false);

  step("wager");
  await sleep(1500);
  await mustAck(host, "host:openQuestion");
  const wagerState = await sync(host);
  assert.equal(wagerState.question?.wager, true);
  await mustAck(ada.socket, "player:answer", { choiceIndex: 0, wager: 50 });
  await mustAck(ben.socket, "player:answer", { choiceIndex: 1, wager: 20 });
  await mustAck(host, "host:lock");
  adaTotal += 50;
  benTotal -= 20;
  const wagered = await sync(host);
  assert.equal(row(wagered, adaName).lastPoints, 50);
  assert.equal(row(wagered, benName).lastPoints, -20);
  assert.equal(row(wagered, adaName).totalScore, adaTotal);
  assert.equal(row(wagered, benName).totalScore, benTotal);
  assert.equal((await mustAck(host, "host:next")).finished, false);

  step("skip");
  await mustAck(host, "host:openQuestion");
  const skipped = await mustAck(host, "host:skip");
  assert.equal(skipped.finished, true);
  const finished = await sync(host);
  assert.equal(finished.phase, "finished");
  assert.equal(row(finished, adaName).totalScore, adaTotal);
  assert.equal(row(finished, benName).totalScore, benTotal);

  step("team night");
  const teamCreated = await api("/api/games", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: teamTitle,
      teamMode: true,
      questions: [q("Team trivia", { gameType: "TRIVIA" })],
    }),
  });
  const teamGame = teamCreated.game as { id: string; code: string; hostToken: string };
  gameIds.push(teamGame.id);
  const teamHost = connectSocket();
  await waitConnect(teamHost);
  await mustAck(teamHost, "host:join", { code: teamGame.code, hostToken: teamGame.hostToken });
  async function joinTeam(name: string, teamName: string) {
    const socket = connectSocket();
    await waitConnect(socket);
    await mustAck(socket, "player:join", { code: teamGame.code, name, teamName });
    return socket;
  }
  const teamAda = await joinTeam(adaName, dogs);
  const teamBea = await joinTeam(beaName, dogs);
  const teamCam = await joinTeam(camName, cats);
  await mustAck(teamHost, "host:openQuestion");
  const lobby = await sync(teamHost);
  assert.equal(lobby.teamMode, true);
  assert.equal(lobby.teamCount, 2);
  assert.equal(lobby.roster.length, 3);
  await mustAck(teamAda, "player:answer", choice);
  const second = await emitAck<Ack>(teamBea, "player:answer", wrong);
  assert.equal(second.ok, false);
  assert.match(second.message || "", /team already answered/);
  await mustAck(teamCam, "player:answer", wrong);
  await mustAck(teamHost, "host:lock");
  const teams = await sync(teamHost);
  assert.equal(row(teams, dogs).lastPoints, POINTS);
  assert.equal(row(teams, cats).lastPoints, 0);
  assert.equal(row(teams, dogs).totalScore, POINTS);
  assert.equal((await mustAck(teamHost, "host:next")).finished, true);

  step("season standings");
  const day = new Date().toISOString().slice(0, 10);
  const season = await api("/api/seasons", cookie, {
    method: "POST",
    body: JSON.stringify({ title: `Live ${tag}`, startsOn: day, endsOn: day }),
  });
  seasonId = (season.season as { id: string }).id;
  const board = await api(`/api/seasons/${seasonId}`, cookie);
  const standings = board.standings as { name: string; points: number; nights: number; wins: number }[];
  function standing(name: string) {
    const found = standings.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`season is missing ${name}`);
    return found;
  }
  const adaSeason = standing(adaName);
  assert.equal(adaSeason.points, adaTotal);
  assert.equal(adaSeason.nights, 1);
  assert.equal(adaSeason.wins, 1);
  const benSeason = standing(benName);
  assert.equal(benSeason.points, benTotal);
  assert.equal(benSeason.wins, 0);
  const dogsSeason = standing(dogs);
  assert.equal(dogsSeason.points, POINTS);
  assert.equal(dogsSeason.wins, 1);
  assert.equal(standing(cats).points, 0);

  console.log("LIVE OK");
  console.log(
    `History still has "${nightTitle}" and "${teamTitle}". Games, the bank, and the season were removed.`
  );
}

main()
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed during ${stepName}: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const socket of sockets) socket.close();
    if (authCookie) {
      for (const id of gameIds) {
        await fetch(`${BASE}/api/games/${id}`, {
          method: "DELETE",
          headers: { Cookie: authCookie },
        }).catch(() => undefined);
      }
      if (bankId) {
        await fetch(`${BASE}/api/banks/${bankId}`, {
          method: "DELETE",
          headers: { Cookie: authCookie },
        }).catch(() => undefined);
      }
      if (seasonId) {
        await fetch(`${BASE}/api/seasons/${seasonId}`, {
          method: "DELETE",
          headers: { Cookie: authCookie },
        }).catch(() => undefined);
      }
    }
  });
