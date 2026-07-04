Here's the full brief — copy everything between the lines into a .md file:

# iTour Reservation App — Migration & Build Brief

> **Purpose of this document.** This is a complete, implementation-ready specification for rebuilding an existing Excel/VBA hotel-reservation & allotment-management workbook as a modern, multi-user, full-stack web application called **iTour Reservation App**. It is written to be handed to **Claude Code CLI** together with the source `.xlsm` workbook. Everything the legacy workbook does — its data model, business rules, calculations, and screen layouts — is documented here so the rebuild starts from a clean spec rather than reverse-engineering.
>
> **How to use it with Claude Code.** Upload the `.xlsm` alongside this file. To read the legacy VBA, run `pip install oletools && olevba <file>.xlsm`. To inspect data/structure, use `openpyxl`/`pandas`. Use this document as the authoritative source of intent; use the workbook only to confirm data values and edge cases.

---

## 1. Product Overview

**iTour Reservation App** is an internal back-office system for a destination-management / inbound tour operator handling hotel bookings in Egyptian Red Sea & Nile resorts. It manages the full lifecycle of a hotel reservation made on behalf of tour operators (TOs), tracks financials in dual currency (USD/EUR), manages hotel room allotments (contracted inventory), and reports materialization (sold vs. contracted) and profit & loss.

The legacy system is a single macro-enabled Excel workbook (`.xlsm`) driven by VBA UserForms. It has outgrown that platform: it needs concurrent multi-user access, role-based permissions, an audit trail, real CSS styling, and access from any device. This brief describes the target web app that replaces it.

### Core domains
1. **Bookings** — create / search / edit hotel reservations for tour operators (the "BKG Bank").
2. **Allotments & Materialization** — per-hotel contracted room inventory by room type, and a calendar grid showing allocation vs. sold vs. stop-sale vs. availability, plus materialization % .
3. **Stop Sale** — date-ranged blocks that remove inventory from sale for a hotel/room-type.
4. **System Parameters** — master/reference data (hotels, room types, lookups) maintained by admins.
5. **Dashboards & Reporting** — KPI overview, P&L, breakdowns by tour operator / market / resort, and PDF exports.

---

## 2. Target Tech Stack (mandatory)

| Layer | Technology |
|---|---|
| Frontend | **Next.js** (App Router, React, TypeScript) |
| UI | **shadcn/ui** + **Tailwind CSS** |
| Backend API | **NestJS** (TypeScript) |
| ORM | **Prisma** |
| Database | **PostgreSQL** |
| Auth | Role-based (multi-user) — see §3 |

### Suggested project layout (monorepo)
itour-reservation-app/ ├─ apps/ │ ├─ web/ # Next.js frontend (shadcn + Tailwind) │ └─ api/ # NestJS backend ├─ packages/ │ ├─ db/ # Prisma schema, migrations, seed │ └─ shared/ # shared TS types / DTOs / validation (zod) └─ docs/

Use a shared `packages/shared` for DTOs and zod schemas so the Next.js client and NestJS server validate against one source of truth. --- ## 3. Authentication, Roles & Permissions (multi-user gating) The app must be **gated**: no page is reachable without authentication, and features are restricted by role. Implement with NestJS guards (JWT + role guard) on the API and Next.js middleware on the client. Use httpOnly cookie sessions or NextAuth/Auth.js with a Credentials/JWT provider — store users in Postgres. ### Roles | Role | Description | Capabilities | |---|---|---| | **Admin** | System owner / IT | Everything, incl. System Parameters (hotels, room types, all lookups), user management, delete. | | **Manager** | Reservations manager | All booking CRUD, allotments, stop sale, dashboards & reports, export. No user management; no destructive master-data deletes. | | **Reservations Agent** | Day-to-day operator | Create/edit bookings, view allotments & materialization, view dashboards. Cannot edit master data (Parameters) or allotments. | | **Accountant** | Finance | Read all bookings; edit financial fields only (Cost/Selling/P&L/Payment/EBD/Visa&Handling/Accounting Remarks); view dashboards & P&L; export. | | **Viewer** | Read-only | View bookings, dashboards, reports. No edits. | ### Rules - Every API route declares the minimum role(s) required via a `@Roles()` decorator + `RolesGuard`. - Field-level gating: the Accountant can edit only the financial sub-set; the UI hides/disables other fields and the API rejects changes to non-permitted fields. - All write operations are recorded in an **AuditLog** (who, when, entity, before/after) — this is a new capability the Excel app lacked and should be built in from the start. - Password reset, account activation/deactivation, and "last login" tracking for Admin. --- ## 4. Data Model The legacy workbook stores everything in flat sheets with free-text values and lookups. The web app must normalize this into proper relational tables with foreign keys and enums. Below is the source-of-truth mapping, then a Prisma schema. ### 4.1 Source sheets → tables | Legacy sheet | Becomes | Notes | |---|---|---| | **BKG Bank** (`Table1`, cols A–AS) | `Booking` | One row = one reservation. ~45 columns. | | **Mat** (cols BG–CU, rows 2–119) | `Hotel` + `HotelRoomType` (allotment) | `BG2:BG119` = hotel master list (~118 hotels). Paired columns `(Room TypeN, AllocN)` per hotel define contracted room types and their daily allocation. | | **Mat** (left grid, calendar) | *No table* — computed | The calendar grid is a **derived view**, not stored data. Recreate as a query/endpoint (see §5.2). | | **Stop Sale** (cols A–E) | `StopSale` | Date-ranged inventory blocks. | | **Params** (lookup columns) | enums / lookup tables | Status, Tour Operator, Market, Resort, Room Category, Meal Basis, Payment Method, Currency, SPO. | ### 4.2 Reference / lookup data (from `Params` sheet) These are small controlled vocabularies. Implement frequently-fixed ones as **Postgres enums** and the ones admins must edit (hotels, room types, tour operators) as **tables** maintained via the System Parameters screen. | Lookup | Values (current) | Recommended impl | |---|---|---| | **Booking Status** | Confirmed, CXL, Pending, Sent, No Show, Bubble, Stop Sale | enum `BookingStatus` | | **Tour Operator** | PAX, JMB, MYW, TRV | table `TourOperator` (admin-editable) | | **Market** | West Market, East European, UK, Turkish, Italian, French | table `Market` (admin-editable) | | **Resort** | SSH, HRG, LXR, CAI, RMF, TCP, MAK, SAF, SMB, SAH, DHB | table `Resort` (admin-editable; these are resort/area codes) | | **Room Category** | DBL, SGL, TPL, Family, Suite, J. Suite | enum `RoomCategory` (the `Room` field, e.g. "DBL") | | **Meal Basis** | AI, BB, HB, FB, SAI, BO | enum `MealBasis` | | **Payment Method** | VCR, Cash, DD, Bubble, 3rd Party | enum `PaymentMethod` | | **Currency** | USD, EUR, GBP, EGP | enum `Currency` | | **SPO** | Yes, N/A | enum / boolean-ish | > **Note on "Room Type" vs "Room Category".** The booking has TWO room concepts: (a) `Room` (col N) = a short category code like "DBL" (from Room Category lookup); (b) `Room Type` (col J) = the hotel-specific named room product (e.g. "DOUBLE - PROMO ROOM", "GRAND ROOM"). The Room Type values come from the hotel's allotment definition on the Mat sheet (each hotel has its own set of named room types). In the data model, `Room Type` must be a foreign key to `HotelRoomType` (scoped to the hotel), NOT a free-text field — this is what links a booking to the allotment for materialization. ### 4.3 `Booking` — full column mapping (BKG Bank Table1, A–AS) | Col | Header | Field | Type | Notes / rule | |---|---|---|---|---| | A | BKG Date | `bookingDate` | Date | Date the booking was entered. | | B | HTL BKG Status | `hotelStatus` | enum BookingStatus | Status with the hotel. | | C | T/O BKG Status | `toStatus` | enum BookingStatus | Status with the tour operator. | | D | T/O | `tourOperatorId` | FK TourOperator | | | E | Market | `marketId` | FK Market | | | F | T/O BKG Ref | `toBookingRef` | String | Tour operator's booking reference (the primary search key). | | G | Sejour Ref | `sejourRef` | String | Secondary reference. | | H | Resort | `resortId` | FK Resort | | | I | Hotel Name | `hotelId` | FK Hotel | | | J | Room Type | `hotelRoomTypeId` | FK HotelRoomType | Hotel-specific named room product (links to allotment). | | K | Arr Date | `arrivalDate` | Date | | | L | Dep Date | `departureDate` | Date | | | M | NTS | `nights` | Int (derived) | **= departureDate − arrivalDate** (do not store; compute). | | N | Room | `roomCategory` | enum RoomCategory | e.g. DBL. | | O | No RMS | `numRooms` | Int | Number of rooms (drives materialization Sold). | | P | AD | `adults` | Int | | | Q | CH | `children` | Int | | | R | INF | `infants` | Int | | | S | MB | `mealBasis` | enum MealBasis | | | T | Guest Name | `guestNames` | String (long) | Comma-separated guest names. | | U | 01st CHD Age | `child1Age` | Int? | | | V | 01st CHD DOB | `child1Dob` | Date? | | | W | 02nd CHD Age | `child2Age` | Int? | Legacy had a quirky formula; treat as plain input. | | X | 02nd CHD DOB | `child2Dob` | Date? | | | Y | Cost USD | `costUsd` | Decimal | What we pay the hotel (USD). | | Z | Selling USD | `sellingUsd` | Decimal | What the TO pays us (USD). | | AA | P/L USD | `plUsd` | Decimal (derived) | **= sellingUsd − costUsd**. | | AB | Cost EUR | `costEur` | Decimal | | | AC | Selling EUR | `sellingEur` | Decimal | | | AD | P/L EUR | `plEur` | Decimal (derived) | **= (sellingEur − costEur) + visaHandling**. | | AE | Payment Method | `paymentMethod` | enum PaymentMethod | | | AF | P. Option Date | `paymentOptionDate` | Date? | Option / deadline date. | | AG | Accounting Remarks | `accountingRemarks` | String? | Finance-only editable. | | AH | Visa&Handling | `visaHandling` | Decimal | Adds into EUR P/L (see AD). | | AI | Arr FLT No | `arrFlightNo` | String? | | | AJ | Arr Time | `arrFlightTime` | String/Time? | | | AK | Dep FLT No | `depFlightNo` | String? | | | AL | Dep FLT Time | `depFlightTime` | String/Time? | | | AM | Meet, Assist & Visa | `meetAssistVisa` | String? | | | AN | Remarks | `remarks` | String? | General remarks. | | AO | EBD % | `ebdPercent` | Decimal | Early Booking Discount %, stored as fraction (0.05 = 5%). Display as %. | | AP | EBD Payment Date | `ebdPaymentDate` | Date? | | | AQ | EBD Payment Amount USD | `ebdAmountUsd` | Decimal (derived) | **= ebdPercent × costUsd**. | | AR | EBD Payment Amount EUR | `ebdAmountEur` | Decimal (derived) | **= ebdPercent × costEur**. | | AS | Guest Name Rebooked | `guestNameRebooked` | String? | Name(s) for a rebooking. | > **Derived fields** (`nights`, `plUsd`, `plEur`, `ebdAmountUsd`, `ebdAmountEur`) should be computed in the API/DB layer (Prisma computed fields, a view, or service-layer logic) and surfaced read-only in the UI — never hand-entered. They were sheet formulas in the legacy app. ### 4.4 `Hotel` & `HotelRoomType` (from Mat sheet, cols BG–CU) The Mat sheet's right block is the **allotment master**: - `BG2:BG119` = hotel names (the master hotel list; some include a resort code suffix in parentheses, e.g. "AMARINA ABU SOMA RESORT & AQUA PARK (SFG)"). - For each hotel row, columns come in **pairs**: `(Room Type name, Allocation qty)` — `BH`/`BI` = Room Type 1 + Alloc 1, `BJ`/`BK` = Room Type 2 + Alloc 2, and so on across to ~col CU. Empty pairs mean the hotel has fewer room types. - So each hotel has 1..N named room types, each with a default daily **allocation** (contracted number of rooms available per night). Normalize to: - `Hotel` (id, name, resortId?, active) - `HotelRoomType` (id, hotelId, name, allocation) — the per-hotel named products with their contracted daily allocation. This is the join target for `Booking.hotelRoomTypeId` and the basis for materialization. ### 4.5 `StopSale` (from Stop Sale sheet, cols A–E) | Col | Field | Type | |---|---|---| | A | `hotelId` | FK Hotel | | B | `hotelRoomTypeId` | FK HotelRoomType | | C | `qty` | Int (rooms removed from sale) | | D | `fromDate` | Date | | E | `toDate` | Date | ### 4.6 Prisma schema (starting point) ```prisma // packages/db/schema.prisma generator client { provider = "prisma-client-js" } datasource db { provider = "postgresql"; url = env("DATABASE_URL") } enum Role { ADMIN MANAGER AGENT ACCOUNTANT VIEWER } enum BookingStatus { Confirmed CXL Pending Sent NoShow Bubble StopSale } enum RoomCategory { DBL SGL TPL Family Suite JSuite } enum MealBasis { AI BB HB FB SAI BO } enum PaymentMethod { VCR Cash DD Bubble ThirdParty } enum Currency { USD EUR GBP EGP } model User { id String @id @default(cuid()) email String @unique passwordHash String name String role Role @default(VIEWER) active Boolean @default(true) lastLoginAt DateTime? createdAt DateTime @default(now()) bookings Booking[] @relation("CreatedBy") } model TourOperator { id String @id @default(cuid()) code String @unique name String? active Boolean @default(true) bookings Booking[] } model Market { id String @id @default(cuid()) code String @unique name String? active Boolean @default(true) bookings Booking[] } model Resort { id String @id @default(cuid()) code String @unique name String? active Boolean @default(true) hotels Hotel[] bookings Booking[] } model Hotel { id String @id @default(cuid()) name String @unique resortId String? resort Resort? @relation(fields: [resortId], references: [id]) active Boolean @default(true) roomTypes HotelRoomType[] bookings Booking[] stopSales StopSale[] } model HotelRoomType { id String @id @default(cuid()) hotelId String hotel Hotel @relation(fields: [hotelId], references: [id]) name String // e.g. "GRAND ROOM" allocation Int @default(0) // contracted daily allotment bookings Booking[] stopSales StopSale[] @@unique([hotelId, name]) } model Booking { id String @id @default(cuid()) bookingDate DateTime hotelStatus BookingStatus toStatus BookingStatus tourOperatorId String tourOperator TourOperator @relation(fields: [tourOperatorId], references: [id]) marketId String market Market @relation(fields: [marketId], references: [id]) toBookingRef String @index sejourRef String? resortId String resort Resort @relation(fields: [resortId], references: [id]) hotelId String hotel Hotel @relation(fields: [hotelId], references: [id]) hotelRoomTypeId String hotelRoomType HotelRoomType @relation(fields: [hotelRoomTypeId], references: [id]) arrivalDate DateTime departureDate DateTime // nights derived = departureDate - arrivalDate roomCategory RoomCategory numRooms Int adults Int @default(0) children Int @default(0) infants Int @default(0) mealBasis MealBasis guestNames String? child1Age Int? child1Dob DateTime? child2Age Int? child2Dob DateTime? costUsd Decimal @default(0) sellingUsd Decimal @default(0) // plUsd derived = sellingUsd - costUsd costEur Decimal @default(0) sellingEur Decimal @default(0) // plEur derived = (sellingEur - costEur) + visaHandling paymentMethod PaymentMethod paymentOptionDate DateTime? accountingRemarks String? visaHandling Decimal @default(0) arrFlightNo String? arrFlightTime String? depFlightNo String? depFlightTime String? meetAssistVisa String? remarks String? ebdPercent Decimal @default(0) // fraction; 0.05 = 5% ebdPaymentDate DateTime? // ebdAmountUsd derived = ebdPercent * costUsd // ebdAmountEur derived = ebdPercent * costEur guestNameRebooked String? createdById String? createdBy User? @relation("CreatedBy", fields: [createdById], references: [id]) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@index([hotelId, arrivalDate, departureDate]) @@index([hotelRoomTypeId]) } model StopSale { id String @id @default(cuid()) hotelId String hotel Hotel @relation(fields: [hotelId], references: [id]) hotelRoomTypeId String hotelRoomType HotelRoomType @relation(fields: [hotelRoomTypeId], references: [id]) qty Int fromDate DateTime toDate DateTime @@index([hotelId, fromDate, toDate]) } model AuditLog { id String @id @default(cuid()) userId String action String // CREATE | UPDATE | DELETE entity String entityId String before Json? after Json? createdAt DateTime @default(now()) }
5. Business Logic & Calculations
All of the following were Excel formulas in the legacy workbook. Re-implement them in the API/service layer (or as Postgres views) so they are computed, not entered.

5.1 Booking-level calculations
Nights = departureDate − arrivalDate (whole days). Legacy: =[Dep Date]-[Arr Date].
P/L USD = sellingUsd − costUsd. Legacy: =Z−Y.
P/L EUR = (sellingEur − costEur) + visaHandling. Legacy: =(AC−AB)+AH. (Note the Visa & Handling amount is added into EUR profit.)
EBD Amount USD = ebdPercent × costUsd. Legacy: =[EBD %]*[Cost USD].
EBD Amount EUR = ebdPercent × costEur. Legacy: =[EBD %]*[Cost EUR].
EBD % display: store as fraction, display as percentage (one decimal, e.g. 5.0%).
Currency display: USD as $#,##0.00, EUR as €#,##0.00. Negative values shown in parentheses.
5.2 Materialization (the Mat calendar — most important computed view)
For a chosen hotel and a date range [From, To], produce a grid. For each room type of that hotel, and for each day in the range, compute four numbers:

Alloc (allocation) = the hotel/room-type contracted allocation (constant per day unless overridden). Legacy: VLOOKUP of hotel into the Mat allotment block.
Sold = total rooms booked that are in-house on that day for that hotel + room type. Legacy formula: =SUMIFS('BKG Bank'!numRooms, 'BKG Bank'!roomType, <thisRoomType>, 'BKG Bank'!hotel, <thisHotel>, 'BKG Bank'!arrDate, "<="&<day>, 'BKG Bank'!depDate, ">" &<day>) i.e. sum numRooms for every booking where arrivalDate ≤ day < departureDate (guest occupies the room on nights from arrival up to, but not including, departure day), matching hotel + room type. SQL equivalent:
SELECT COALESCE(SUM(num_rooms),0)
FROM "Booking"
WHERE hotel_id = :hotelId AND hotel_room_type_id = :roomTypeId
  AND arrival_date <= :day AND departure_date > :day
  AND hotel_status NOT IN ('CXL','NoShow');   -- exclude cancellations (confirm rule)
Confirm with the business whether cancelled/no-show bookings should be excluded from Sold. The legacy SUMIFS did not filter status, so to match exactly, do not filter — but flag this as an improvement candidate.

SS (Stop Sale) = rooms blocked that day. Legacy: =SUMIFS('Stop Sale'!qty, hotel, roomType, fromDate<=day, toDate>day) SQL: sum StopSale.qty where hotel+roomType match and fromDate ≤ day < toDate.
Avail (available) = Alloc − Sold (legacy =Alloc−Sold). Note: legacy availability subtracts Sold only; Stop Sale is shown separately. Consider whether Avail should be Alloc − Sold − SS — confirm with business.
Mat % (materialization) = Sold / Alloc per room type over the period (legacy =TTL Sold / TTL Allot, blank if Alloc = 0).
Totals row per room type: TTL Allot = Σ Alloc over days, TTL Sold = Σ Sold over days, Mat% = TTL Sold / TTL Allot.

Grid presentation rules (carried from legacy, keep in web UI):

Each room type is a block of rows: Alloc / Sold / SS / Avail (the legacy "Prod / TTL Allot / TTL Sold / SS / Mat%" labels).
Hide empty room types — room types with no allocation/data are not shown.
Hide the SS (Stop Sale) row when not relevant — legacy hid the 4th row of each block; in the web grid, make SS a collapsible row or hide when all zero.
Cells are color-coded (conditional formatting) by availability — e.g. green when rooms available, red/over-allotment when Sold ≥ Alloc, amber near full. Reproduce with Tailwind classes / a heat scale.
Provide a PDF export of the grid for a chosen hotel + date range (use a server-side PDF render, e.g. Puppeteer or react-pdf), preserving the color coding and excluding hidden rows.
5.3 Dashboard / Reporting
Reproduce these aggregate views (legacy Dashboard sheet):

Overview KPIs: total bookings, total rooms, total P/L (USD & EUR), average materialization, etc. — filterable by date range and status.
P&L view: profit by period, by tour operator, by market, by resort.
Breakdowns: bookings/revenue grouped by Tour Operator, by Market, by Resort (bar charts).
All views filterable by date range, status, hotel, TO, market, resort.
Implement as SQL GROUP BY aggregations exposed via API endpoints; render with shadcn charts / a chart lib.
6. Screens / UI Inventory
The legacy app used dark-themed VBA UserForms (header RGB 15,23,42) with a left-hand menu. Rebuild as responsive web pages using shadcn/ui + Tailwind. Keep the left-nav shell. Reference screenshots of the legacy Booking form are provided with the workbook.

6.1 App shell
Left sidebar nav with two groups: VIEWS (Dashboard / Overview / P&L / Breakdowns / Materialization) and MANAGE (Bookings, Stop Sale, System Parameters [admin], Users [admin]).
Top bar: current user, role badge, logout, global search (by T/O Booking Ref).
Dark theme by default; shadcn ThemeProvider.
6.2 Booking form (the main data-entry screen)
Mirrors the legacy Booking UserForm. Grouped into cards/sections (exact field grouping from the legacy form):

Search bar — "T/O Booking Reference" input + Search button (loads an existing booking by toBookingRef).
Booking & Status — Booking Date, T/O BKG Ref, Sejour Ref, Tour Operator (select), Market (select), HTL BKG Status (select), T/O BKG Status (select).
Hotel & Stay — Hotel Name (searchable select), Room Type (select, cascades from chosen hotel — only that hotel's room types), No of Rooms, Meal Basis (select), Arrival Date, Departure Date, Resort (select), Nights (read-only, computed), Room category (select).
Financials & Payment — Cost USD, Selling USD, P/L USD (read-only), Cost EUR, Selling EUR, P/L EUR (read-only), Payment Method (select), P. Option Date, EBD % , EBD Payment Date, EBD Payment Amount USD/EUR (read-only, live-computed), Visa & Handling, Accounting Remarks.
Guests & Occupancy — Adults, Children, Infants, 1st CHD Age, 1st CHD DOB, 2nd CHD Age, 2nd CHD DOB, Guest Names (textarea).
Flights & Transfer — Arr FLT No, Arr FLT Time, Dep FLT No, Dep FLT Time, Meet/Assist & Visa.
Remarks — General Remarks (textarea).
Guest Name Rebooked — textarea.
Cascade rule: when Hotel changes, the Room Type select must repopulate from that hotel's HotelRoomType list (this was a VLOOKUP/OFFSET helper in the legacy sheet). Live calculations: Nights, P/L USD, P/L EUR, EBD amounts update as the user types (client-side preview; server recomputes on save).

6.3 Bookings list
Searchable/filterable/paginated table of bookings (by ref, hotel, TO, market, resort, status, date range). Row click → Booking form. Respect role permissions for edit/delete. Export to CSV/Excel.
6.4 Materialization screen
Controls: Hotel (select) + Date range (From/To). Renders the calendar grid from §5.2 with color coding, hidden empty/SS rows, totals, and a PDF export button.
6.5 Stop Sale screen
CRUD list of stop-sale blocks (hotel, room type, qty, from, to). Manager/Admin only.
6.6 System Parameters (Admin)
Tabbed editor (mirrors legacy tabbed form): tabs for Hotels & Allotment (manage hotels and their room types + allocations), Tour Operators, Markets, Resorts, and (if kept as data) Statuses / Meal Basis / Payment Methods / Currencies / SPO.
The legacy app password-gated this screen — in the web app it is simply Admin-role gated.
6.7 Users (Admin)
New screen (no legacy equivalent): create/edit users, assign roles, activate/deactivate, reset password.
6.8 Dashboards
Overview, P&L, Breakdowns as described in §5.3, with shadcn cards + charts and global filters.
7. API Surface (NestJS) — indicative
Group by module. All routes JWT-protected; @Roles() as noted.

POST /auth/login (public) POST /auth/logout GET /auth/me GET /bookings ?ref&hotelId&toId&marketId&resortId&status&from&to&page POST /bookings (AGENT+) GET /bookings/:id PATCH /bookings/:id (AGENT+; field-gated for ACCOUNTANT) DELETE /bookings/:id (MANAGER+) GET /bookings/by-ref/:toRef (search) GET /hotels GET /hotels/:id/room-types (for cascade) POST /hotels (ADMIN) PATCH/DELETE /hotels/:id (ADMIN) POST /hotels/:id/room-types (ADMIN) PATCH/DELETE .../room-types/:rtId (ADMIN) GET /stop-sales POST/PATCH/DELETE (MANAGER+) GET /materialization ?hotelId&from&to -> grid JSON GET /materialization/pdf ?hotelId&from&to -> PDF GET /dashboard/overview ?from&to&...filters GET /dashboard/pl ?... GET /dashboard/breakdowns ?groupBy=tourOperator|market|resort GET /lookups (tour operators, markets, resorts, enums for selects) GET /users POST PATCH DELETE (ADMIN) /users/:id/reset-password
8. Data Migration
Export each sheet to CSV (or read the .xlsm directly with pandas/openpyxl).
Seed lookups first: TourOperator, Market, Resort, and the enums.
Seed Hotels + HotelRoomTypes from Mat BG2:BG119 and the paired (Room TypeN, AllocN) columns. Skip empty pairs. Parse the trailing resort code in parentheses where present to link resortId.
Seed StopSale from the Stop Sale sheet.
Import Bookings from BKG Bank Table1. Resolve foreign keys by matching the text values to seeded lookups (Hotel by name, Room Type by hotel+name, TO/Market/Resort by code). Compute derived fields on insert. Log unmatched rows for manual review.
Convert Excel serial dates (e.g. 45650) to real dates during import (date(1899,12,30) + serial days).
Validate row counts and spot-check P/L and materialization totals against the workbook.
9. Non-Functional Requirements
TypeScript everywhere, strict mode.
Validation with zod (shared package); server-side validation authoritative.
Audit logging on every write.
Money stored as Decimal (never float); render with currency formats from §5.1.
Dates stored as UTC DateTime; the booking domain is date-only (no time) except flight times (free string).
Pagination on all list endpoints.
Optimistic UI but server is source of truth for computed fields.
Tests: unit-test the materialization & P/L calculators against known workbook values.
Accessibility & responsive: shadcn components, mobile-friendly tables.
10. Build Order (suggested for Claude Code)
Scaffold monorepo (Next.js + NestJS + Prisma + Postgres + shadcn/Tailwind), auth + roles, app shell with left nav.
Prisma schema + migrations + seed (lookups, hotels, room types).
Bookings module end-to-end (API + list + form with cascade + live calcs) — the core slice. Prove it fully before expanding.
Materialization view + PDF export.
Stop Sale CRUD.
System Parameters (admin) + Users.
Dashboards (overview, P&L, breakdowns).
Data migration scripts + validation.
Hardening: audit log, tests, role field-gating, polish.
Appendix A — Legacy reference (for confirming values only)
Source: single .xlsm. Key sheets: BKG Bank (Table1, A–AS), Mat (allotment master cols BG–CU rows 2–119; calendar grid is computed), Stop Sale (A–E), Params (lookup columns), Dashboard.
Legacy VBA forms: frmBooking, frmSystemParameters, frmDashboard, frmMaterialization, frmEBDList; classes clsNavBtn/clsSearchCombo/clsDateBox; modDashboard. Read via olevba to confirm any nuanced rule, but this document is the intended behavior — do not carry over VBA-specific workarounds (e.g. the deleted "Lists" sheet, MSForms layout hacks).
The legacy app stored EBD % as a fraction and displayed as %; dates as Excel serials; dual-currency financials with Visa & Handling folded into EUR P/L. Preserve these semantics.
--- That's the complete brief. A couple of notes: - You can delete the empty **Migration Brief** sheet that got added — I didn't end up populating it. - Two business rules I deliberately left as "confirm with business" (so Claude Code doesn't guess wrong): whether **cancelled/no-show bookings** count toward "Sold", and whether **Avail** should subtract Stop Sale. Decide those before the materialization module is built.