# iTourResLite — working agreement for Claude

## Golden rule: no drift between source, git, and the running app

**Any** change to this system — DB/schema, Prisma/Zod DTOs, API code, the shared
package, or web UI/UX — must be carried all the way through so the working tree,
the git remote, and the running containers never diverge.

The production stack builds images **from source with no bind mounts**, so edits
are invisible to the live app until rebuilt and redeployed. Therefore, after
completing a coherent, verified change (not every intermediate file edit — finish
and verify first), always run the full cycle **in order**:

1. **Rebuild** the affected image(s):
   ```bash
   docker compose -f docker-compose.prod.yml build api web
   ```
   (The web build type-checks the frontend; the api runs ts-node from `src`.)
2. **Verify** it works — build exits 0 and the affected flow actually behaves
   (drive the API on `127.0.0.1:8011` or the web on `127.0.0.1:8010`).
3. **Commit & push** to the current branch with a descriptive message.
4. **Deploy** and confirm health:
   ```bash
   docker compose -f docker-compose.prod.yml up -d api web
   ```

### Schema/DB changes
Apply the schema **before** deploying app code (this repo has no migration
history — it syncs directly):
```bash
docker compose -f docker-compose.prod.yml --profile setup run --rm migrate
# runs: prisma generate + prisma db push. Never seeds.
```
The seed is a **separate, fresh-install-only** service — it rewrites
lookups/hotels/demo users, and with `FORCE_SEED=true` deletes every booking and
stop sale to re-import the legacy spreadsheet. Never run it on a live database:
```bash
docker compose -f docker-compose.prod.yml --profile seed run --rm seed
```

### Exceptions
- Docs/comment-only changes with no runtime surface: still **commit & push**, but
  the rebuild/deploy step may be skipped.
- If any step fails or is skipped, **say so explicitly** — never report success
  for a step that didn't run.

## Deployment facts
- Orchestration: **Docker Compose** (`docker-compose.prod.yml`), not Kubernetes.
- Services: `postgres`, `api` (→ `127.0.0.1:8011`), `web` (→ `127.0.0.1:8010`),
  fronted by the host nginx + certbot.
- Secrets come from `.env` (`POSTGRES_PASSWORD`, `JWT_SECRET`, `LICENSE_SERVER_URL`).
- This VPS also hosts unrelated co-tenant apps — never touch their ports/configs.
