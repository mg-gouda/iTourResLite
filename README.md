# iTour Reservation App

Back-office system for an inbound tour operator managing hotel bookings, room
allotments, materialization, and dual-currency P&L. Rebuild of a legacy
Excel/VBA workbook as a multi-user web app. Full spec: [`iTourResLite.md`](./iTourResLite.md).

## Stack

- **Web** — Next.js (App Router) + React + TypeScript + Tailwind + shadcn-style UI, TanStack Query, react-hook-form + zod.
- **API** — NestJS + Prisma + PostgreSQL. JWT (httpOnly cookie) auth, role-based access, audit log.
- **Shared** — `@itour/shared` (zod DTOs, enums, derived-field calculators, formatters, RBAC helpers) — one source of truth for client + server.
- **DB** — `@itour/db` (Prisma schema + seed/migration from the legacy workbook).

```
apps/web   apps/api   packages/db   packages/shared
```

## Quick start (Docker)

```bash
cp .env.example .env          # set JWT_SECRET etc.
docker compose up -d postgres
docker compose up api web     # api pushes schema + seeds on first boot
```

| Service  | URL                                |
|----------|------------------------------------|
| Web      | http://localhost:3000              |
| API      | http://localhost:4000/api/v1       |
| Health   | http://localhost:4000/api/v1/health|
| Postgres | localhost:5432 (db `itour`)        |

## Local (without Docker)

```bash
pnpm install
# point DATABASE_URL at a running Postgres, then:
pnpm db:generate && pnpm db:push && pnpm db:seed
pnpm --filter @itour/api dev      # :4000
pnpm --filter @itour/web dev      # :3000
```

## Demo accounts (seeded)

Password for all: **`Passw0rd!`**

| Email                  | Role        |
|------------------------|-------------|
| admin@itour.app        | Admin       |
| manager@itour.app      | Manager     |
| agent@itour.app        | Agent       |
| accountant@itour.app   | Accountant  |
| viewer@itour.app       | Viewer      |

## Data migration

The seed imports the legacy workbook (`Docs/W25-26 Fulvago.xlsm`) — lookups,
~91 hotels / 300 room types, ~1,900 stop-sale blocks, ~648 bookings. JSON
extracted into `packages/db/seed-data/`. FKs resolved by fuzzy name match;
room types created on miss so no booking is dropped. Derived fields
(nights, P/L, EBD amounts) are computed, never imported.

## Tests

```bash
pnpm test     # calculators (vs known workbook values) + materialization rules
```

## Business rules (decided)

- **Sold** excludes `CXL` / `No Show` bookings.
- **Avail = Alloc − Sold − SS** (stop sale subtracted).

See [`iTourResLite.md`](./iTourResLite.md) §5 for the full calculation spec.
