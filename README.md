<p align="center">
  <img src="public/brand/trivia-live-logo.png" alt="Trivia Live" width="320" />
</p>

# Trivia Live

Live trivia for up to **200 players**. Build games ahead of time, open a host screen on a big display, and let people answer from their phones. Scores update live; correct + faster answers rank higher.

Pick a **game type** when you create a night: classic multiple-choice **Trivia**, **Image Zoom** (a photo starts cropped in tight on the host screen and zooms out as the timer runs down), or **Guess the Song** (a short clip starts sped up on the host speakers and eases to normal speed). A game is one type only — types are not mixed in a single night.

## Features

- **Admin** — create and edit games; choose **Trivia**, **Image Zoom**, or **Guess the Song**; 2–6 options (or True/False on trivia); per-question timers and scoring; optional late-join lock
- **Image Zoom** — upload a JPEG/PNG/WebP/GIF per round (5 MB max); starting crop Close / Tight / Extreme; photo plays only on the **host screen**; phones show the prompt, timer, and answer buttons
- **Guess the Song** — upload a short clip per round (MP3, M4A, WAV, OGG, or AAC, 10 MB max); starts fast and eases to normal speed; audio plays only on the **host** TV/speakers; phones are the answer pad. Host taps Play to start the clip and the round clock.
- **Host screen** — join code, QR → `/join?code=…`, typed join URL, live lobby roster, question control, reveal, between-round standings pause, podium finish. Opening the host screen opens the lobby.
- **Player phones** — join with code + name (no accounts); remembered display name; reconnect after refresh; rank/points after each round. Names are filtered for the projector (letters/numbers/spaces; obvious slurs blocked). Hosts can **Remove** a player from the lobby or standings.
- **Scoring** — server timestamps only (phones can’t fake speed); board updates on lock so mid-question standings don’t spoil answers
- **Play again** — clear players/scores, keep questions, issue a new join code
- **Export / import** — download a pack (JSON for Trivia; zip with media for Image Zoom and Guess the Song). Import creates a new draft you own. Packs never include join codes, host tokens, players, or scores.
- **Duplicate / send a copy** — clone a night for yourself, or send a copy to another host on this instance (they get a new draft; you keep the original)
- **Past winners** — hall of fame in admin (winner, podium, date/time) survives Play again
- Built for work, family, or group events on a small VPS or bare-metal box

## Stack

| Layer | Choice |
|-------|--------|
| UI | Next.js (App Router) |
| Realtime | Socket.io |
| Database | Postgres + Prisma |
| Deploy | Docker Compose |

## Quick start (Docker)

```bash
cp .env.example .env
# set SESSION_SECRET, SUPERADMIN_PASSWORD (or SETUP_TOKEN), and POSTGRES_PASSWORD

# First boot only — create the default admin from env:
SUPERADMIN_BOOTSTRAP=1 docker compose up --build -d
```

App listens on **127.0.0.1:3000** (loopback). Open [http://127.0.0.1:3000](http://127.0.0.1:3000) on the server, or put Cloudflare Tunnel in front for public HTTPS.

Bootstrap defaults (only when `SUPERADMIN_BOOTSTRAP=1` and no admin exists yet):

- Email: `admin@localhost`
- Password: value of `SUPERADMIN_PASSWORD` (example: `trivia-admin` / change-me)

Then set `SUPERADMIN_BOOTSTRAP=0` in `.env` for subsequent restarts.

## Local development

```bash
# 1. Postgres (published on 127.0.0.1:5432 only)
docker compose up -d db

# 2. Env
cp .env.example .env
# edit DATABASE_URL / secrets

# 3. Install + schema
npm install
npx prisma migrate deploy
# or: npx prisma db push

# 4. Run (Next + Socket.io on one port)
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Accounts

Login is **email + password** (not a shared single password).

- **First install** — either open `/admin` and create the first super-admin (production requires `SETUP_TOKEN` on the form), **or** set `SUPERADMIN_BOOTSTRAP=1` once with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`.
- **After setup** — keep `SUPERADMIN_BOOTSTRAP=0`. Set a strong `SESSION_SECRET` (24+ chars). If `SESSION_SECRET` is missing/weak the app still starts with an ephemeral secret (sessions reset on restart) and logs a warning.
- **Account** — any signed-in user can change their own name, email, and password.
- **Super-admins** — manage other super-admins (can’t delete the last one).
- **Hosts** — create accounts that only see their own games.

## How a game works

1. Sign in at **`/admin`** with a host or super-admin account and create a game. Choose **Trivia**, **Image Zoom**, or **Guess the Song**, then add questions. Mark the correct option with the radio next to each choice. Optionally set base points, speed bonus, timer, and **Allow late joins**.
2. Open **Host screen** (big display). The lobby opens when that page connects; you can also click **Open lobby** from the games list first.
3. Players scan the **QR** (opens `/join` with the code filled in) or open the join URL shown on the host and enter the code, then pick a name.
4. Host presses **Start question 1** → players answer against the countdown → auto-lock at 0 (or **Lock now**) → reveal correct answer + standings. On Image Zoom, the host photo starts zoomed in and opens at a steady rate until lock/reveal. On Guess the Song, the host taps **Play** so the clip starts fast on the room speakers and the round clock starts with it.
5. Host presses **Continue** → between-round standings pause → **Start question N** for the next prompt (not an immediate jump).
6. After the last question, the host shows a **top-3 podium** and final standings. Phones show place and score.
7. **Play again** (admin or finished host screen) clears players/scores, keeps questions, issues a **new join code**, and reopens the lobby. Phones are sent back to `/join`.
8. Finished nights appear under **Past winners** in admin (date/time, winner, podium, player count).

You can **Edit** a game in admin to fix questions or settings before answers exist (or after Play again). Mid-round edits are blocked.

**Duplicate** makes a draft copy for you (new join code). **Send a copy** does the same for another host on this site. **Export** downloads a pack to move a night between machines or email it; **Import pack** on My games turns that file into a new draft. Image Zoom and Guess the Song packs include the uploaded files — only export audio you have the right to share.

### Join codes

Codes use an unambiguous alphabet (no `I`/`J`/`L`/`O`/`Q`/`0`/`1`) so they’re easy to read off a big screen.

### Late joins

By default players can join during the lobby **or** mid-game. Uncheck **Allow late joins** on the game to limit joining to the lobby only.

### Image Zoom

Host uploads one image per question. During the round the host display shows the photo (players do not). It starts tightly cropped and zooms out until time is up or the host locks. Scoring is the same as trivia: correct + faster is better.

### Guess the Song

Host uploads a short snippet per question (chop it first — about 12–20 seconds). Audio plays only on the host system, not on player phones. The clip starts sped up and eases toward normal speed over the timer. The round clock starts when the host taps **Play** (so autoplay restrictions don’t fire before the room is ready).

**Only use audio you have the right to host.** A short clip is not automatically fair use, and a venue’s ASCAP/BMI/SESAC license covers playing music in the room — not copying files into this app. Use clips you created, recordings in the public domain, Creative Commons (or similar) licenses that allow this use, or a library whose license covers hosting and playback at your event. Do not upload commercial tracks from Spotify, YouTube, or a ripped CD unless you have a separate license that allows it.

Uploads (images and audio) are stored on disk (`UPLOAD_DIR`, default `data/uploads` locally or `/app/data/uploads` in Docker). Deleting a game (or replacing a saved file) removes the files that belonged to it.

### Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Anyone | Landing |
| `/admin` | Host / super-admin | Build/edit games, import/export packs, past winners; super-admin also manages hosts |
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
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose DB credentials (`DATABASE_URL` is derived) | `trivia` / `trivia` / `trivia_live` |
| `DATABASE_URL` | Postgres URL (local `npm run dev`) | see `.env.example` |
| `SETUP_TOKEN` | Required for first-time `/admin` setup in production (unless bootstrap) | unset |
| `SUPERADMIN_BOOTSTRAP` | `1` = create first admin from env on boot | `0` |
| `SUPERADMIN_EMAIL` | Bootstrap email | `admin@localhost` |
| `SUPERADMIN_PASSWORD` | Bootstrap password | `trivia-admin` |
| `SUPERADMIN_NAME` | Bootstrap display name | `Super Admin` |
| `SESSION_SECRET` | Signs login cookies (**set in production**, 24+) | unset (ephemeral warning) |
| `COOKIE_SECURE` | Set `1` behind HTTPS / Cloudflare | `1` in Compose |
| `PORT` | HTTP + WebSocket port | `3000` |
| `HOST` | Bind address inside the container | `0.0.0.0` |
| `NEXT_PUBLIC_SOCKET_URL` | Leave empty when UI and sockets share the same origin | _(empty)_ |
| `NEXT_PUBLIC_PUBLIC_URL` | Public HTTPS origin for host QR / join URLs | _(browser origin)_ |
| `UPLOAD_DIR` | Directory for Image Zoom and Guess the Song uploads | `data/uploads` (Compose: `/app/data/uploads`) |

## Scripts

```bash
npm run dev          # custom server (Next + Socket.io), watch mode
npm run build        # prisma generate + next build
npm start            # production server
npm run db:push      # push schema (dev)
npm run db:migrate   # prisma migrate deploy
npm run test:scoring # unit checks for the score formula
npm run test:zoom    # unit checks for Image Zoom scale-over-time
npm run test:audio-speed # unit checks for Guess the Song playback-rate curve
npm run test:display-name # unit checks for projector name filter
npm run test:game-pack   # unit checks for export/import packs
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
src/components/   Logo, QR, countdown, question editor, zoom image, sped-up audio
src/lib/          DB, scoring, game manager, auth helpers, media uploads
prisma/           Schema + migrations
scripts/          Smoke test + scoring/zoom/audio tests + admin bootstrap
docker-compose.yml
Dockerfile
```

## Hosting

A **1–2 vCPU / 1–2 GB RAM** box is enough for ~200 concurrent phones.

Compose binds the app to **127.0.0.1:3000** and Postgres to **127.0.0.1:5432** so they are not open to the public internet. Put Cloudflare Tunnel (or another reverse proxy) in front for HTTPS.

```bash
# on the server
git clone <this-repo>
cd trivia-live
cp .env.example .env
# edit .env: SESSION_SECRET, POSTGRES_PASSWORD, SUPERADMIN_PASSWORD / SETUP_TOKEN,
#            NEXT_PUBLIC_PUBLIC_URL=https://your.domain
SUPERADMIN_BOOTSTRAP=1 docker compose up --build -d
# then set SUPERADMIN_BOOTSTRAP=0 in .env
```

### Cloudflare Tunnel (recommended)

Yes — this works behind a **Cloudflare Tunnel**. You do **not** need Caddy/nginx TLS on the box.

- Cloudflare terminates **HTTPS** on your hostname.
- `cloudflared` connects outbound to Cloudflare and proxies to `http://127.0.0.1:3000` on the server (plain HTTP on loopback is fine).
- **WebSockets are supported** by Cloudflare Tunnel. In the Cloudflare dashboard, keep **Network → WebSockets** On (default on most plans). Socket.io for live play uses WebSockets; leave `NEXT_PUBLIC_SOCKET_URL` empty so the browser uses the same public origin.
- Set `NEXT_PUBLIC_PUBLIC_URL=https://your.domain` so host QR codes and join URLs use the public hostname (not `127.0.0.1`).
- Keep `COOKIE_SECURE=1` so admin session cookies are marked Secure.

Example tunnel ingress (hostname → local app):

```yaml
ingress:
  - hostname: trivia.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

If you use a classic reverse proxy instead of a tunnel: put HTTPS in front, proxy WebSocket upgrades (`Upgrade` / `Connection` headers) to port 3000, and still set `NEXT_PUBLIC_PUBLIC_URL`.

### Autostart on Ubuntu

`docker-compose.yml` uses `restart: unless-stopped` so containers come back after a crash or reboot **once Docker itself is running**.

```bash
sudo systemctl enable --now docker
cd /opt/trivia-live   # or your install path
docker compose up --build -d
```

Also enable `cloudflared` (or your tunnel package) to start on boot so the public hostname stays up.

Optional — manage the Compose stack as a systemd unit:

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

### Updating

On the server, from the repo directory:

```bash
git pull
docker compose up --build -d
```

Migrations run automatically on container start (`prisma migrate deploy` in the entrypoint). Postgres data in the `trivia_pg` volume and media uploads in `trivia_uploads` are kept across rebuilds.

If you use the systemd unit above:

```bash
cd /opt/trivia-live
git pull
sudo systemctl restart trivia-live
```

## Capacity notes

- ~200 WebSocket connections is light for a single Node process
- Live board updates are throttled so answer bursts don’t flood the host display
- One game of 200 players is the design target; many small concurrent games also fit on the same small server
