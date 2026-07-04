# Running iTour Reservation App (VS Code + WSL)

Practical run guide for **this machine** (Ubuntu/WSL2). Includes the network
workarounds for the npmjs-via-Cloudflare block found on this network.

---

## 1. Open in VS Code (Remote-WSL)

From the Ubuntu terminal, in the repo root:

```bash
cd ~/iTourResLite
code .
```

That launches VS Code attached to WSL (bottom-left should say **WSL: Ubuntu**).
Use the VS Code integrated terminal for all commands below — it runs inside WSL.

> If `code` isn't found: open VS Code on Windows once, install the **WSL**
> extension (`ms-vscode-remote.remote-wsl`), then `code .` works from WSL.

---

## 2. One-time network workaround (this network blocks npmjs/Cloudflare)

npmjs.org fronts through Cloudflare, which times out here. Mirrors work.
Set these in the shell you'll install from:

```bash
export NODE_OPTIONS="--dns-result-order=ipv4first"
export PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
```

(IPv4-first because the DNS here returns only unroutable IPv6 for npm;
the Prisma mirror because its engines also live behind Cloudflare.)

If DNS itself misbehaves again, prefer IPv4 system-wide once:

```bash
sudo sed -i 's@^#precedence ::ffff:0:0/96  100@precedence ::ffff:0:0/96  100@' /etc/gai.conf
```

---

## 3. Install dependencies (from the mirror)

```bash
pnpm install --registry https://registry.npmmirror.com
```

- `pnpm` missing? `corepack enable` (or `nvm use 22`).
- frozen-lockfile / integrity complaint? append `--no-frozen-lockfile` once.

---

## 4. Generate client + verify

```bash
pnpm db:generate     # Prisma client (uses the engine mirror)
pnpm typecheck       # tsc across web + api + db + shared
pnpm test            # vitest: calculators + materialization rules
```

---

## 5. Run the app

### Option A — pnpm (lightest)

Needs a Postgres. Start just the DB in Docker, run the apps on the host:

```bash
docker compose up -d postgres
pnpm db:push         # create schema
pnpm db:seed         # import the workbook (≈648 bookings, 91 hotels…)

# two terminals (or VS Code split terminal):
pnpm --filter @itour/api dev     # http://localhost:4000/api/v1
pnpm --filter @itour/web dev     # http://localhost:3000
```

### Option B — full Docker

```bash
docker compose up -d postgres
docker compose up api web
```

> ⚠️ Docker image builds run their own `pnpm install` and will hit the blocked
> npmjs. If the build fails on network, ask me to bake the mirror into the
> Dockerfile/`.npmrc` (one small commit) — then `docker compose` works here too.

---

## 6. Open it

| URL | What |
|---|---|
| http://localhost:3000 | Web app (login here) |
| http://localhost:4000/api/v1/health | API health |
| http://localhost:8025 | — (no mailhog in this project) |

**Login:** `admin@itour.app` · password `Passw0rd!`
Other seeded roles: `manager@`, `agent@`, `accountant@`, `viewer@` `itour.app`
(same password).

---

## 7. Service URLs / ports

- Web (Next.js): **3000**
- API (NestJS): **4000** → base path `/api/v1`
- Postgres: **5432** (db `itour`, user `itour`, pw from `.env` / default `changeme`)

Copy env first if you haven't: `cp .env.example .env` (defaults work for local).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pnpm install` hangs at "added N" | Chromium download — already disabled via `.npmrc` (`puppeteer_skip_download=true`). |
| `ERR_SOCKET_TIMEOUT` on npmjs | Use `--registry https://registry.npmmirror.com` (step 3). |
| `prisma generate` hangs | Ensure `PRISMA_ENGINES_MIRROR` is exported (step 2). |
| Port already in use | `pnpm dev:down` / `docker compose down`, or change ports in `docker-compose.yml`. |
| Web can't reach API | Confirm API on :4000 and `NEXT_PUBLIC_API_URL` in `.env`. |
