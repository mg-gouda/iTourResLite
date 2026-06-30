#!/bin/sh
set -e

echo "[entrypoint] Generating Prisma client..."
pnpm --filter @itour/db generate

echo "[entrypoint] Applying schema to database..."
# Dev uses db push (no migration history). For prod, swap to: pnpm --filter @itour/db migrate:deploy
pnpm --filter @itour/db push

echo "[entrypoint] Seeding (idempotent)..."
pnpm --filter @itour/db seed || echo "[entrypoint] seed skipped/failed (continuing)"

echo "[entrypoint] Starting API..."
exec pnpm --filter @itour/api dev
