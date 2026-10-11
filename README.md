<p align="center">
  <img src="public/brand/trivia-live-logo.png" alt="Trivia Live" width="320" />
</p>

# Trivia Live

Live trivia for up to **200 players**. Build games ahead of time, open a host screen on a big display, and let people answer from their phones. Scores update live; correct + faster answers rank higher.

Each question picks its own type: classic multiple-choice **Trivia**, **Image Zoom**, **Picture Finish**, **Silhouette**, **Guess the Song**, **Backwards Song**, **Unscramble**, or **Finish the Line**. A night can mix them. A question can also be a **closest number** (nearest guess wins, ties included) or a **wager** (players bet up to their current score; a miss subtracts the bet).

## Features

- **Admin** — create and edit games. Each question has its own type, timer, and points. A night can mix types. Optional late-join lock, **Team night**, **Allow changing answers**, and named rounds (Movies, Science, Final). **Question banks** are reusable trivia pools (the bank name becomes the round). Search and sort the games list. **Preview as player** shows the phone layout without the photo, clip, puzzle text, or correct answer.
- **Eight question types** — Trivia, Image Zoom, Picture Finish, Silhouette, Unscramble, Finish the Line, Guess the Song, and Backwards Song. Setup and what each screen shows are under [Question types](#question-types).
- **Answer styles** — any question can instead be a typed answer, a closest number, or a wager. See [Answer styles](#answer-styles).
- **Host screen** — join code, QR → `/join?code=…`, typed join URL, second-TV watch URL, live lobby roster, reveal, between-round standings, podium finish. Opening the host screen opens the lobby. Start, Lock, Continue, Remove, Skip, Void, Pause, and Add 10 seconds live on **Controls** (`/remote/[code]`), meant for the host’s phone. Song rounds still use Play on the big screen so the room speakers can start.
- **Spectator** — `/watch/[code]` is the same big-screen board, including photos, puzzles, and song audio, with no Start, Lock, Remove, or Play again. Anyone with the join code can open it; it never includes the host token and does not open the lobby.
- **Player phones** — join with code + name (no accounts); remembered display name; reconnect after refresh; rank and points after each round. On a team night, players also enter a team name. Names are filtered for the projector (letters, numbers, spaces, hyphen, apostrophe; obvious slurs blocked). Hosts can **Remove** a player; that name cannot rejoin until **Play again**. Answer buttons are large-type with colorblind-safe A–F letter chips.
- **Scoring** — server timestamps only (phones can’t fake speed). The board updates on lock so mid-question standings don’t spoil answers. Optional **Double points** (2×) or **Lightning** (correct or wrong, no speed bonus). A streak of 3 or more correct answers is called out on the boards. Tied first place shares the win.
- **Play again** — clear players, scores, and kick-bans, keep questions, issue a new join code
- **Export / import** — download a pack (JSON for Trivia, Unscramble, and Finish the Line; zip with media for the photo and song types). Import creates a new draft you own. Packs never include join codes, host tokens, players, or scores.
- **Duplicate / send a copy** — clone a night for yourself, or send a copy to another host on this instance (they get a new draft; you keep the original)
- **History** — **Past winners** keeps the winner, podium, and date after Play again. Each finished night also stores a **recap** (full standings and per-question answers) you can view or download as CSV. **Season** adds night scores across a date range.
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

1. Sign in at **`/admin`** with a host or super-admin account and create a game. On each question, pick a type, write the prompt, and mark the correct choice (or turn on [Typed answer](#typed-answer), [Closest number](#closest-number), or [Wager](#wager)). **Add from bank** inserts trivia questions. Optionally set base points, speed bonus, **Double points** or **Lightning**, the timer, **Allow late joins**, **Allow changing answers**, **Team night**, and **round names** (leave blank to stay in the previous round). Use **Preview as player** to see the phone layout without revealing media or the answer. Banks live in **Admin → Banks**; first setup also creates a **Starter pack**. **Export** downloads a JSON bank. **Import bank** accepts that JSON, or a CSV with a header row of `prompt`, `A`, `B`, `C`, `D`, and `correct` (a letter, the option text, or a 1-based number).
2. Open **Host screen** (big display). The lobby opens when that page connects; you can also click **Open lobby** from the games list first. For a second display, open **Watch** (same join code, no host token).
3. Players scan the **QR** (opens `/join` with the code filled in) or open the join URL shown on the host and enter the code, then pick a name.
4. Host presses **Start question 1** on the big screen or on Controls. Players answer against the countdown. The question auto-locks at 0, or the host presses **Lock now**. Reveal shows the correct answer, how many players picked each option, and the standings. What the room sees depends on the question type — photos, puzzles, and songs play on the host and watch screens; phones stay the answer pad. Song rounds wait until the host taps **Play** on the big screen, which starts both the clip and the clock. Pause, extra time, skip, and void are on [Host controls](#host-controls).
5. Host presses **Continue** → between-question standings pause → **Start question N** for the next prompt (not an immediate jump). If you named rounds, the last question of a round shows that round’s mini-podium before the next section.
6. After the last question, the host shows a **top-3 podium** and final standings. Phones show place and score.
7. **Play again** (admin or finished host screen) clears players/scores and any kick-bans, keeps questions, issues a **new join code**, and reopens the lobby. Phones are sent back to `/join`.
8. Finished nights appear under **Admin → History → Past winners** (date/time, winner, podium, player count). Open **Recap** for full standings and per-question accuracy, or download a CSV. Recaps stay after Play again. **History → Season** adds those night scores together for a date range you name. The same name, ignoring caps and extra spaces, is one player. A missed night adds nothing. Wins are nights where that name tied for first. Team nights count the team name. Dates are the UTC calendar day of the finish, so a late evening in the US can land on the next day. Deleting a season does not delete the nights.

You can **Edit** a game in admin to fix questions or settings before answers exist (or after Play again). Mid-round edits are blocked.

**Duplicate** makes a draft copy for you (new join code). **Send a copy** does the same for another host on this site. **Export** downloads a pack to move a night between machines or email it; **Import pack** on My games turns that file into a new draft. Image Zoom, Picture Finish, Silhouette, Guess the Song, and Backwards Song packs include the uploaded files — only export audio you have the right to share.

### Join codes

Codes use an unambiguous alphabet (no `I`/`J`/`L`/`O`/`Q`/`0`/`1`) so they’re easy to read off a big screen.

### Late joins

By default players can join during the lobby **or** mid-game. Uncheck **Allow late joins** on the game to limit joining to the lobby only.

### Changing answers

Off by default. Turn on **Allow changing answers** so players can switch their pick until the question locks. Speed bonus uses the **last tap** — changing at the last second scores like a last-second answer, so you cannot bank a fast time and then swap in the correct pick.

### Remove

**Remove** on Controls deletes that player and blocks the display name for the rest of the night (case-insensitive). They can pick a different name. **Play again** clears the block list with the new join code.

### Named rounds

Optional. On each question, set a **round name** (Movies, Science, Final). Leave it blank to stay in the previous round. The host lobby lists the sections; phones and the TV show the current round. After the last question of a named round (when more questions remain), BETWEEN shows that round’s mini-podium. Unnamed games behave as before.

### Team night

Off by default. Turn on **Team night** on the game. Joining then asks for a team name as well as a player name. The team shares one answer and one score: the first teammate to answer locks it in, unless **Allow changing answers** is on. The leaderboard is teams. The roster is still people. **Remove** drops that person; a teammate who is still in keeps the team’s answers. Season standings use the team name.

### Question types

Each question has a type. The host and watch screens play that type. Phones are the answer pad and do not receive the photo, the audio file, or the puzzle text. Scoring is the usual correct-and-faster formula unless the question is a [wager](#wager) or a [closest number](#closest-number).

#### Trivia

The default. Write a prompt and 2–6 choices, or use **True / False**. Mark the correct choice with the radio button. The prompt and the choices show on the host, the watch screen, and the phones. Players tap a letter. A correct answer scores base points plus a speed bonus; a wrong answer scores 0.

#### Image Zoom

Upload one JPEG, PNG, WebP, or GIF (5 MB max). Crop it square with the subject in the center. **Starting crop** is Close, Tight, or Extreme: how far in the photo starts. During the question the host and watch screens zoom out until the timer ends or the host locks. Phones show the prompt, the timer, and the answer buttons. They never get the image.

#### Picture Finish

Same upload and square crop as Image Zoom. **Starting mosaic** is Soft, Heavy, or Extreme: how chunky the photo is when the timer starts. The host and watch screens ease from that mosaic to a sharp photo over the question timer. Phones never see the photo.

#### Silhouette

Same upload as Image Zoom. A subject on a plain background reads more clearly. **Starting shape** is Soft, Heavy, or Extreme: how long the photo stays a solid shape before the color comes back. The host and watch screens play that fill-in. Phones never see the photo.

#### Unscramble

Type the phrase to unscramble. During the question the host screen shows those letters jumbled, then locks them into place from the left as the timer runs. Spaces and punctuation stay put. A watch screen receives only the letters currently showing, and the solved phrase only at reveal. Phones show the prompt and the answer buttons, not the phrase.

#### Finish the Line

Type a lyric, quote, or sentence. The first word is on the host screen when the question opens. The remaining words appear in order over the timer. A watch screen receives only the words that have appeared so far, until the reveal. Phones never receive the line.

#### Guess the Song

Upload one short clip per question. Chop it first, about 12–20 seconds. Accepted files are MP3, M4A, WAV, OGG, or AAC, up to 10 MB. **Starting speed** is Easy 1.5×, Fast 2×, or Extreme 2.5×. The clip starts at that speed and eases to normal over the question timer.

The host taps **Play snippet** on the big screen. That starts the clip on the room speakers and starts the round clock, so the browser’s autoplay rules don’t fire before the room is ready. A watch TV can then play the clip locally. That listen does not start or restart the clock. Phones never receive the audio file. Pause and Add 10 seconds are available only after Play has started the clock.

#### Backwards Song

Same upload as Guess the Song. The host taps **Play** and the clip loops fully reversed on the room speakers. The round clock starts with that tap. A watch TV can play the reversed clip locally after that, without starting the clock. On the results screen, **Replay forwards** plays the original direction once. Phones never receive the audio file.

**Only use audio you have the right to host.** A short clip is not automatically fair use, and a venue’s ASCAP/BMI/SESAC license covers playing music in the room — not copying files into this app. Use clips you created, recordings in the public domain, Creative Commons (or similar) licenses that allow this use, or a library whose license covers hosting and playback at your event. Do not upload commercial tracks from Spotify, YouTube, or a ripped CD unless you have a separate license that allows it.

Uploads (images and audio) are stored on disk (`UPLOAD_DIR`, default `data/uploads` locally or `/app/data/uploads` in Docker). Deleting a game, or replacing a saved file, removes the files that belonged to it.

### Answer styles

These are checkboxes on a question, not separate types. They change how phones answer. The question’s type still controls the host screen. **Closest number** cannot be combined with **Typed answer** or **Wager**. Typed and wager can be used together.

#### Typed answer

Turn on **Typed answer**. The lines you enter are the accepted answers, up to six. The line marked with the radio is the one shown at reveal. Extra lines are other answers that also count, and they stay hidden.

Players type on the phone. The accepted text is not on the host, the watch screen, or the phones until reveal. Matching ignores capitals, accents, punctuation, and a leading The, A, or An. `&` counts as “and”. The typo allowance uses the longer of the guess and the accepted answer: none at 3 characters or fewer, one character up to 6, and two after that.

#### Closest number

Turn on **Closest number**. The choices are replaced by one **Correct number**. Players type a number on the phone. The target stays off every screen until reveal. Words are rejected; only a number is stored.

Points are decided when the question locks, because the winner is not known until every guess is in. The closest guess or guesses win, and a tie means every one of those guesses wins. Winners get the normal correct-answer score, including the speed bonus from when they submitted. Everyone else scores 0. A non-number is not a guess.

#### Wager

Turn on **Wager**. Players pick an answer and bet a whole number of points, from 0 up to the score they have right now. A right answer adds the bet. A wrong answer subtracts it. There is no speed bonus. On the first question everyone has 0, so the only legal bet is 0.

At reveal, a multiple-choice wager still shows the choices. A typed wager asks the phone for both the text and the bet.

### Host controls

Controls live on the host’s phone at `/remote/[code]`. The token is stored in the browser and removed from the address bar. Song **Play** stays on the big screen.

- **Pause / Resume** — freezes the countdown. Answers are rejected while paused. The photo, puzzle, or song freezes with the clock and continues from that frame on resume. On a song, the clock has to be started with Play before pause is available.
- **Add 10 seconds** — adds 10 seconds to the deadline, up to 120 extra seconds, whether or not the question is paused. Scoring uses the longer limit. The zoom, mosaic, silhouette, song-speed ease, and puzzle reveal still follow the original timer. Extra time does not stretch those animations.
- **Skip question** — nobody keeps points for it, and the night moves on.
- **Void · zero points** — scores already given for this question drop to 0.
- **Void · credit everyone** — each player (or each team, on a team night) is marked correct at base points, with no speed bonus. On a wager, the credit is the bet they already placed, or 0 if they had not bet.

### Spectator / second TV

`/watch/[code]` is a read-only host board for a second display. It uses the public join code (shown on the host lobby as **Second TV**, and as **Watch** in admin). It never receives `hostToken`, cannot Start, Lock, Remove, End, or Play again, and does not open a draft lobby. During Unscramble and Finish the Line it receives the text that is on screen at that moment, and the solved line only when the question is revealed. After **Play again**, watch screens follow the new code.

### Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Anyone | Landing |
| `/admin` | Host / super-admin | Build and edit games, banks, pack import/export, past winners, seasons; super-admin also manages hosts |
| `/host/[code]?token=…` | Host display | Live board for the room. Song rounds still start with Play on this screen |
| `/remote/[code]?token=…` | Host phone | Start, Lock, Continue, Remove, Skip, Void, Pause, and Add 10 seconds. The token is stored and removed from the address bar |
| `/watch/[code]` | Spectator TV | Same live board and media, no controls |
| `/join` | Players | Enter code + name (`?code=` prefill from QR) |
| `/play/[code]` | Players | Answer questions |

## Scoring

On a normal question, only a correct answer scores, and a faster one scores higher:

```text
points = base + timeBonus × (1 − elapsed / timeLimit)
```

Defaults per question: **base 500**, **time bonus 500** → max **1000** if answered instantly. Wrong answers get **0**. Totals carry across the whole game.

Per-question flags in the builder:

- **Double points** — the usual formula, then ×2.
- **Lightning** — time bonus is ignored; a correct answer scores base points only.

Elapsed time is measured on the **server** from question open (or from **Play**, on a song) to the answer that counts. Per-question base and bonus can be set in the admin builder. If **Allow changing answers** is on, players may switch their pick until the clock hits zero; speed bonus is recalculated from that later tap (a last-second change does not keep an early speed bonus).

A [closest number](#closest-number) uses this formula only for the winning guess or guesses, and only once the question locks. A [wager](#wager) ignores it: the points are the bet, added or subtracted. A [typed answer](#typed-answer) uses the formula when the text matches an accepted line.

After reveal, between questions, and at the finish, the boards call out the longest current streak of **3 or more** correct answers. If two or more players share the top score at the end, they are co-winners (the recap lists them as `Ada & Ben`). There is no extra sudden-death question.

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
| `UPLOAD_DIR` | Directory for photo and song uploads | `data/uploads` (Compose: `/app/data/uploads`) |
| `BACKUP_DIR` | Host folder for `scripts/backup.sh` | `./backups` |

## Scripts

```bash
npm run dev          # custom server (Next + Socket.io), watch mode
npm run build        # prisma generate + next build
npm start            # production server
npm run db:push      # push schema (dev)
npm run db:migrate   # prisma migrate deploy
npm run test:unit    # all offline unit suites (no server required)
npm run test:all     # alias for test:unit
npm run test:scoring # unit checks for the score formula
npm run test:zoom    # unit checks for Image Zoom scale-over-time
npm run test:picture-finish # Picture Finish pixel/zoom curve
npm run test:image-crop     # zoom crop geometry
npm run test:audio-speed # unit checks for Guess the Song playback-rate curve
npm run test:audio-reverse # unit checks for Backwards Song sample reversal
npm run test:text-reveal    # Unscramble, Finish the Line, and Silhouette timing
npm run test:display-name # unit checks for projector name filter
npm run test:game-pack   # unit checks for export/import packs
npm run test:rounds      # unit checks for named round grouping
npm run test:night-recap # unit checks for finish-time recap + CSV
npm run test:bans        # banned display-name matching
npm run smoke        # live join + answer burst (app must be running; not part of test:unit)
npm run live         # live play of every question type (app must be running)
npm run test:score-race # 200-answer lock race (needs DATABASE_URL; writes throwaway games, then deletes them)
```

Smoke test options (set real admin creds against production):

```bash
SMOKE_PLAYERS=50 SMOKE_BASE_URL=https://trivia-live.com \
  SUPERADMIN_EMAIL='you@example.com' SUPERADMIN_PASSWORD='…' \
  npm run smoke

SMOKE_PLAYERS=200 SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke
```

Full live check (health, every question type, pause, +10s, typed answers, closest number, wager, void, skip, kick, teams, bank import, pack import, and season standings). Run it on the server so the sockets stay on localhost. It uses a handful of players, then deletes the games, bank, and season. The two finished nights stay in History under titles starting with `Live`.

```bash
SUPERADMIN_EMAIL='you@example.com' SUPERADMIN_PASSWORD='…' \
  LIVE_BASE_URL=http://127.0.0.1:3000 npm run live
```

`npm run smoke` is still the 200-phone burst. It leaves a game titled `Smoke <timestamp>` in admin.

## Project layout

```text
server/           Custom Node server + Socket.io handlers
src/app/          Next.js pages (admin, host, play, join) + API routes
src/components/   Logo, QR, countdown, question editor, zoom image, sped-up and reversed audio
src/lib/          DB, scoring, game manager, auth helpers, media uploads
prisma/           Schema + migrations
scripts/          Live suite, smoke test, unit tests, backup, admin bootstrap
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

Migrations run automatically on container start (`prisma migrate deploy` in the entrypoint). If that fails, the container exits instead of rewriting the schema. Postgres data in the `trivia_pg` volume and media uploads in `trivia_uploads` are kept across rebuilds.

The app container checks `GET /api/health` every 30 seconds. That returns 200 when Postgres answers and the uploads directory is writable, and 503 otherwise. Docker marks the container unhealthy after three failures. The response is `{ ok, db, uploads }` and does not include secrets.

Process logs are one JSON object per line on stdout (info) or stderr (warn and error), with `time`, `level`, and `msg`.

### Backup

From the repo directory, with the database already up:

```bash
./scripts/backup.sh
```

That writes `backups/<UTC stamp>/trivia.pgdump` (Postgres custom format) and `uploads.tgz` (the uploads volume). `backups/` is not committed. Set `BACKUP_DIR` if you want another host folder. This command is not on a timer — run it yourself, or from cron on the server.

To restore, stop the app first so nothing writes during the copy:

```bash
docker compose stop app
docker compose exec -T db pg_restore --clean --if-exists --no-owner \
  -U "${POSTGRES_USER:-trivia}" -d "${POSTGRES_DB:-trivia_live}" \
  < backups/<stamp>/trivia.pgdump
docker run --rm \
  -v "$(docker volume ls -q --filter name=trivia_uploads)":/uploads \
  -v "$PWD/backups/<stamp>":/in:ro \
  alpine \
  sh -c 'find /uploads -mindepth 1 -delete && tar xzf /in/uploads.tgz -C /uploads'
docker compose start app
```

`--clean` drops existing tables before loading the dump. The uploads volume name ends in `trivia_uploads` (Compose prefixes the project directory). If more than one volume matches, pass the full name from `docker volume ls` instead of the command substitution.

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
- Run one app instance. Question timers and the rate limiter live in that process’s memory. A second instance splits joins across both, arms two timers for one question, and gives each box its own rate limit.
