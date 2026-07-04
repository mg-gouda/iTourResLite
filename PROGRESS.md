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

## [2026-06-30] Q&A decisions applied + all phases completed

**Scope:** Applied finalized product decisions from Q&A session, fixed divergences from the initial build.

**Decisions applied:**
- Local Market merged into BKG Bank (added `costEgp`, `sellingEgp`, `fileNumber` to Booking; EGP currency; Rehla.Com/IND TOs; EGY market).
- Calculation fields (`calculationUsd`, `calculationEur`, `calculationEgp`) — free-text display-only on Booking.
- All 9 lookups as admin-editable DB tables via System Parameters (removed Prisma enums: `BookingStatus`, `RoomCategory`, `MealBasis`, `PaymentMethod`; kept `Currency` enum removed too). New models: `BookingStatusLookup`, `RoomCategoryLookup`, `MealBasisLookup`, `PaymentMethodLookup`, `CurrencyLookup`, `SpoLookup`.
- Materialization: avail = Alloc − Sold (NOT minus SS — SS shown separately). Fixed bug in `materialization.calc.ts`.
- Arrival/Departure Transfers: built as web reports.
- Send to Hotel: `mailto:` link endpoint (`POST /bookings/:id/send-hotel-email`).
- Materialization date range: any From/To, no cap (was already correct in service).

**Changes made:**
- `schema.prisma`: removed BookingStatus/RoomCategory/MealBasis/PaymentMethod/Currency enums; added 6 lookup models; added Booking fields: costEgp, sellingEgp, calculationUsd/Eur/Egp, fileNumber; String fields for status/category/basis/method.
- `packages/db/prisma/seed.ts`: removed Prisma enum imports; seeds 6 new lookup tables; added EGY market, Rehla.Com/IND TOs; uses string values throughout.
- `packages/shared`: enums.ts (z.string() validators), calc.ts (plEgp/ebdAmountEgp/deriveBooking extended), dto.ts (new booking fields + reportQuerySchema), roles.ts (EGP fields in ACCOUNTANT_EDITABLE_FIELDS), format.ts (fallback symbol).
- `apps/api`: bookings.service.ts (EGP in DECIMAL_FIELDS), bookings.controller.ts (send-hotel-email endpoint), lookups.controller.ts (serves all 9 lookups from DB), params.controller.ts + params.module.ts (CRUD for 6 new lookup tables), new reports module (6 endpoints).
- `apps/web`: booking-form.tsx (EGP section, calculation fields, fileNumber, DB-driven lookups, Send to Hotel button), bookings/page.tsx (DB-driven status filter), system/parameters/page.tsx (6 new tabs), app-shell.tsx (Reports nav section), 6 new report pages.

**To run after these changes:**
```bash
pnpm db:push    # apply schema changes
pnpm db:seed    # re-seed (replaces bookings; upserts lookups/hotels/users)
pnpm --filter @itour/api dev
pnpm --filter @itour/web dev
```
