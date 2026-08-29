# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owner, office staff, and accountant of a small Philippine trucking fleet operation (inferred from role gating in `src/components/Layout.tsx` and peso formatting). The owner runs the business from an office desktop; staff log trips daily; the accountant handles payroll.

## Product Purpose

FastHaul is a trucking operations ERP: it logs Transportify bookings as trips, tracks gross revenue, expenses, and driver/helper commissions per trip, distributes diesel costs across trips, computes payroll, and reports profitability by period, vehicle type, driver, and customer.

## Positioning

Trip-ledger simplicity for small fleets: customers are auto-tracked from trip phone numbers, diesel is distributed across trips, and commissions are deducted automatically — no separate bookkeeping tools. (Inferred from page subtitles in `Layout.tsx`.)

## Operating Context

- Bookings come through Transportify (third-party logistics marketplace); each trip carries a Transportify ID.
- Currency is Philippine peso (₱).
- Roles: owner (full access), staff (operations), accountant (payroll + reports) — enforced in navigation and actions.

## Capabilities and Constraints

- Pages: Dashboard/Reports, Trips, Calendar, Employees, Vehicles, Customers, Diesel Distribution, Payroll & Commissions, Settings (vehicle types, commission rules, company profile).
- Cloud sync via Supabase with local-first store fallback; cloud errors surface as toasts.
- Command palette search (⌘K / Ctrl+K) over trips, drivers, plates, customers, pages.
- Light/dark theme toggle.
- CSV report export from the dashboard.
- Undecided: multi-tenant signup flow is in progress (migrations 009–011 on disk, uncommitted).

## Brand Commitments

- Name: FastHaul, tagline "Fleet Operations" (sidebar brand lockup).
- The Stitch reference at `stitch_serene_trucking_dashboard/` (screen.png + DESIGN.md, "Kinetic Soft-Shell") is the user-pinned visual direction for the redesign.
