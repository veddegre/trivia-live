# Trivia Live

Live trivia for up to **200 players**. Build games ahead of time, open a host screen on a big display, and let people answer from their phones. Scores update live; correct + faster answers rank higher.

## Features

- **Admin** — create and edit games; 2–6 options (or True/False); per-question timers and scoring; optional late-join lock
- **Host screen** — join code, QR → `/join?code=…`, typed join URL, live lobby roster, question control, reveal, between-round standings pause, podium finish
- **Player phones** — join with code + name (no accounts); remembered display name; reconnect after refresh; rank/points after each round
- **Scoring** — server timestamps only (phones can’t fake speed); board updates on lock so mid-question standings don’t spoil answers
- **Play again** — clear players/scores, keep questions, issue a new join code
- **Past winners** — hall of fame in admin (winner, podium, date/time) survives Play again
- Built for work, family, or group events on a small VPS

## Stack

| Layer | Choice |
|-------|--------|
| UI | Next.js (App Router) |
| Realtime | Socket.io |
| Database | Postgres + Prisma |
| Deploy | Docker Compose |

## Quick start (Docker)

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

Default admin password: `trivia-admin`  
Override with `ADMIN_PASSWORD=your-secret docker compose up --build`.

## Local development

```bash
# 1. Postgres
docker compose up -d db

# 2. Env
cp .env.example .env
# edit DATABASE_URL / ADMIN_PASSWORD if needed

# 3. Install + schema
npm install
npx prisma migrate deploy
# or: npx prisma db push

# 4. Run (Next + Socket.io on one port)
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## How a game works

1. Sign in at **`/admin`** and create a game (title + questions). Mark the correct option with the radio next to each choice. Optionally set base points, speed bonus, timer, and **Allow late joins**.
2. Click **Open lobby**, then **Host screen** (opens on a big display).
3. Players scan the **QR** (opens `/join` with the code filled in) or open the join URL shown on the host and enter the code, then pick a name.
4. Host presses **Start question 1** → players answer against the countdown → auto-lock at 0 (or **Lock now**) → reveal correct answer + standings.
5. Host presses **Continue** → between-round standings pause → **Start question N** for the next prompt (not an immediate jump).
6. After the last question, the host shows a **top-3 podium** and final standings. Phones show place and score.
7. **Play again** (admin or finished host screen) clears players/scores, keeps questions, issues a **new join code**, and reopens the lobby. Phones are sent back to `/join`.
8. Finished nights appear under **Past winners** in admin (date/time, winner, podium, player count).

You can **Edit** a game in admin to fix questions or settings before answers exist (or after Play again). Mid-round edits are blocked.

### Join codes

Codes use an unambiguous alphabet (no `I`/`J`/`L`/`O`/`Q`/`0`/`1`) so they’re easy to read off a TV.

### Late joins

By default players can join during the lobby **or** mid-game. Uncheck **Allow late joins** on the game to limit joining to the lobby only.

### Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Anyone | Landing |
| `/admin` | Host / organizer | Build/edit games, past winners |
| `/host/[code]?token=…` | Host display | Control game + live board |
| `/join` | Players | Enter code + name (`?code=` prefill from QR) |
| `/play/[code]` | Players | Answer questions |

## Scoring

Only correct answers score. Faster is better:

```text
points = base + timeBonus × (1 − elapsed / timeLimit)
```

Defaults per question: **base 500**, **time bonus 500** → max **1000** if answered instantly. Wrong answers get **0**. Totals carry across the whole game.

Elapsed time is measured on the **server** from question open to answer receive. Per-question base/bonus can be set in the admin builder.

Scores are stored when answers land but **not added to the board until the question locks**, so the live standings don’t spoil who got it right. After lock/reveal, the host shows who’s in the lead (with round deltas); phones show rank and round points. Between rounds, standings stay up until the host starts the next question.

## Environment

Copy from `.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgresql://trivia:trivia@localhost:5432/trivia_live` |
| `ADMIN_PASSWORD` | Password for `/admin` | `trivia-admin` / `change-me` in example |
| `PORT` | HTTP + WebSocket port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `NEXT_PUBLIC_SOCKET_URL` | Leave empty when UI and sockets share the same origin | _(empty)_ |
| `NEXT_PUBLIC_PUBLIC_URL` | Public origin for host-screen join QR / URL (set to your LAN IP when testing phones locally) | _(current browser origin)_ |

## Scripts

```bash
npm run dev          # custom server (Next + Socket.io), watch mode
npm run build        # prisma generate + next build
npm start            # production server
npm run db:push      # push schema (dev)
npm run db:migrate   # prisma migrate deploy
npm run test:scoring # unit checks for the score formula
npm run smoke        # 200-player join + answer burst (app must be running)
```

Smoke test options:

```bash
SMOKE_PLAYERS=200 SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke
```

## Project layout

```text
server/           Custom Node server + Socket.io handlers
src/app/          Next.js pages (admin, host, play, join) + API routes
src/components/   Brand, QR, countdown, question editor
src/lib/          DB, scoring, branding, game manager, auth helpers
prisma/           Schema + migrations
scripts/          Smoke test + scoring tests
docker-compose.yml
Dockerfile
```

## Hosting

A **1–2 vCPU / 1–2 GB RAM** box is enough for ~200 concurrent phones.

```bash
# on the VPS
git clone <this-repo>
cd trivia-live
export ADMIN_PASSWORD='a-strong-password'
docker compose up --build -d
```

Put **HTTPS** in front (Caddy, nginx, or a reverse proxy). Enable WebSockets on the proxy. For production, change `ADMIN_PASSWORD` and keep `.env` out of git.

Set `NEXT_PUBLIC_PUBLIC_URL` to your public origin (e.g. `https://trivia.example.com`) so host QR codes and join URLs point at the right place for phones.

### Autostart on Ubuntu

`docker-compose.yml` uses `restart: unless-stopped` so containers come back after a crash or reboot **once Docker itself is running**.

```bash
# Docker daemon on boot
sudo systemctl enable --now docker

# Bring the stack up (from the repo directory)
docker compose up --build -d
```

Optional — manage the stack as a systemd unit (replace the working directory path):

```bash
sudo tee /etc/systemd/system/trivia-live.service >/dev/null <<'EOF'
[Unit]
Description=Trivia Live
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/trivia-live
EnvironmentFile=-/opt/trivia-live/.env
ExecStart=/usr/bin/docker compose up -d --build
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now trivia-live
```

## Capacity notes

- ~200 WebSocket connections is light for a single Node process
- Live board updates are throttled so answer bursts don’t flood the host display
- One game of 200 players is the design target; many small concurrent games also fit on the same small server
