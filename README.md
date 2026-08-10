# Bar Trivia

Live bar trivia for up to **200 players**. Build games ahead of time, open a host screen on the TV, and let people answer from their phones. Scores update live; correct + faster answers rank higher.

## Features

- **Admin** — create games with multiple-choice questions, time limits, and point settings
- **Host screen** — join code, lobby headcount, question control, live leaderboard, final winner
- **Player phones** — join with a short code + display name (no accounts); reconnect after refresh
- **Scoring** — server timestamps only (phones can’t fake speed)
- Built for a single venue night on a small VPS

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
npx prisma db push

# 4. Run (Next + Socket.io on one port)
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## How a night works

1. Sign in at **`/admin`** and create a game (title + questions). Mark the correct option with the radio next to each choice.
2. Click **Open lobby**, then **Host screen** (opens on a big display).
3. Players go to **`/join`**, enter the code shown on the host screen, and pick a name.
4. Host presses **Start question** → players answer → **Lock answers** → reveal → **Next question**.
5. After the last question, the host screen shows the **winner** and full standings.

### Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Anyone | Landing |
| `/admin` | Host / organizer | Build and manage games |
| `/host/[code]?token=…` | Host TV | Control game + live board |
| `/join` | Players | Enter code + name |
| `/play/[code]` | Players | Answer questions |

## Scoring

Only correct answers score. Faster is better:

```text
points = base + timeBonus × (1 − elapsed / timeLimit)
```

Defaults per question: **base 500**, **time bonus 500** → max **1000** if answered instantly. Wrong answers get **0**. Totals carry across the whole game.

Elapsed time is measured on the **server** from question open to answer receive.

## Environment

Copy from `.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgresql://trivia:trivia@localhost:5432/bar_trivia` |
| `ADMIN_PASSWORD` | Password for `/admin` | `trivia-admin` / `change-me` in example |
| `PORT` | HTTP + WebSocket port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `NEXT_PUBLIC_SOCKET_URL` | Leave empty when UI and sockets share the same origin | _(empty)_ |

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
src/lib/          DB, scoring, game manager, auth helpers
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
cd bar-trivia
export ADMIN_PASSWORD='a-strong-password'
docker compose up --build -d
```

Put **HTTPS** in front (Caddy, nginx, or a reverse proxy). For production, change `ADMIN_PASSWORD` and keep `.env` out of git.

## Capacity notes

- ~200 WebSocket connections is light for a single Node process
- Live board updates are throttled so answer bursts don’t flood the host display
- One game of 200 players is the design target; many small concurrent games also fit on the same small server
