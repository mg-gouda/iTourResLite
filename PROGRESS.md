# PROGRESS — iTour Reservation App

Session log. Newest last.

## [2026-06-30] Initial full-stack build from brief

**Scope:** Scaffold the monorepo and implement all phases of `iTourResLite.md`.

**Decisions locked with product owner:**
- Project lives in-place in `iTourResLite/` (alongside the brief + workbook).
- Materialization rules (improved): **Sold** excludes `CXL`/`No Show`; **Avail = Alloc − Sold − SS**.
- Password hashing via Node `scrypt` (this brief does not mandate argon2 — no native dep, portable).

**Built:**
- Root tooling: pnpm workspace, turbo, tsconfig base, docker-compose, `.env.example`.
- `packages/db`: Prisma schema (§4.6) with enum `@map`s for legacy spellings; seed + legacy
  migration importing the `.xlsm` (lookups, 91 hotels / 300 room types, ~1,935 stop sales, 648 bookings).
- `packages/shared`: zod DTOs, enums + labels, derived-field calculators, money/percent formatters,
  RBAC helpers, scrypt password util, response types.
- `apps/api` (NestJS): JWT cookie auth + global JwtAuthGuard/RolesGuard, audit log,
  uniform error envelope, zod validation pipe. Modules: auth, bookings (CRUD + by-ref +
  Accountant field-gating + soft delete), hotels/room-types (cascade), params (TO/Market/Resort CRUD),
  stop-sales, materialization (grid + PDF/HTML), dashboard (overview/pl/breakdowns), users, lookups, health.
- `apps/web` (Next.js): app shell, auth, booking form + list, materialization grid, stop sale,
  system parameters, users, dashboards. (Searchable Combobox/AsyncCombobox everywhere.)
- Tests: calculators vs known workbook values; materialization rule unit tests.

**Migration / Tests:** schema via `prisma db push` (dev); seed idempotent. Vitest unit tests.

**Notes / follow-ups:**
- `prisma migrate` history not generated yet (dev uses `db push`); create an initial migration before prod.
- Materialization PDF uses Puppeteer when present, else returns print-ready HTML (Puppeteer is an optional dep).
- Stop-sale legacy `qty = -1` is treated as a full stop (ss = allocation).
