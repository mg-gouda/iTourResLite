# Product

## Register

product

## Users

Back-office staff at an Egyptian destination-management company (DMC) / inbound tour operator. Roles: Reservations Agents (primary daily users — create & manage bookings), Accountants (finance view, cost/selling edits), Managers (oversight, reports, allotments), Admins (system config). All users are internal; no public access. Typically used on desktop in an office environment. Density is welcome; wasted space is not.

## Product Purpose

iTour Reservation App replaces an Excel/VBA workbook that managed hotel reservations for tour operators operating in Egyptian Red Sea & Nile resorts. It tracks the full booking lifecycle (confirm, cancel, rebook), hotel room allotments vs. sold vs. stop-sale, financial P&L in USD/EUR/EGP, materialization grids, and operational reports. Success means agents can manage 100+ concurrent bookings without Excel, with role gating, an audit trail, and cross-device access.

## Brand Personality

Precise. Efficient. Authoritative. The tool should feel like a Bloomberg terminal ran through a modern design system — data-forward, high information density, zero decorative noise. Every pixel earns its place by helping a user do their job faster.

## Anti-references

- Consumer travel apps (Booking.com, Airbnb, Expedia) — no photos, cards, gradients, or leisure-UI patterns. This is a back-office, not a booking engine.
- Generic startup SaaS (Notion/Linear clones) — not minimalist-white, not "calm productivity." This tool lives in a busy operations environment.
- Legacy enterprise (SAP, Oracle) — not boxy gray. Dense but modern; fast even when packed with data.

## Design Principles

1. **Data first.** The table, the grid, the number — that is the UI. Everything else frames it. Navigation, headers, filters: minimal surface area, maximum legibility.
2. **Role shapes the view.** The interface narrows to what each role can actually do. Clutter is disabled states for someone else's permissions.
3. **Speed over ceremony.** Zero loading spinners mid-content. Skeleton states only. Forms submit fast, errors surface inline, success is a toast.
4. **Earned density.** Tight spacing is a feature, not a bug — when users need to see 40 bookings at once, dense rows are correct. Never compress headings; always compress data.
5. **Trust through consistency.** Same button shape, same input style, same icon family everywhere. Familiarity is the UX; surprise is a bug.

## Accessibility & Inclusion

WCAG 2.1 AA minimum. All tables keyboard-navigable. Color alone never carries meaning (status uses icon + color). Reduced motion respected. High contrast for dense financial data is non-negotiable — muted gray text on dark surfaces is banned.
