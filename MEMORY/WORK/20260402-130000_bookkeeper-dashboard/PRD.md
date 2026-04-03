---
task: Build personalized bookkeeper dashboard for Lori McGill
slug: 20260402-130000_bookkeeper-dashboard
effort: advanced
phase: complete
progress: 28/28
mode: interactive
started: 2026-04-02T13:00:00Z
updated: 2026-04-02T13:00:00Z
---

## Context

Lori McGill is the bookkeeper. She needs a purpose-built dashboard that shows:
1. Sales broken down by location/event — who bought what, what they paid, how they paid, delivery status
2. Texas Sales & Use Tax Exemption Certificate tracking — customers have 30 days from purchase to submit; Lori must track who has/hasn't submitted

### Technical Approach
- DB migration adds `tax_exempt_cert_received` boolean and `tax_exempt_cert_received_at` timestamptz to contracts table
- Dashboard route: `/bookkeeper` page with its own data fetching; dashboard/page.tsx redirects bookkeeper role there
- Three new components: BookkeeperDashboard (server), TaxExemptTracker (client), SalesByEventList (client)
- New API route: PATCH /api/contracts/[id]/tax-exempt to mark cert received

## Criteria

- [ ] ISC-1: Migration file created adding tax_exempt_cert_received boolean to contracts
- [ ] ISC-2: Migration file created adding tax_exempt_cert_received_at timestamptz to contracts
- [ ] ISC-3: API route created at /api/contracts/[id]/tax-exempt handles PATCH
- [ ] ISC-4: API route restricts cert marking to bookkeeper/admin/manager roles
- [ ] ISC-5: /bookkeeper page exists and fetches contracts with all required fields
- [ ] ISC-6: Dashboard redirects bookkeeper role to /bookkeeper
- [ ] ISC-7: Summary stats show total revenue, deposits collected, balance outstanding, delivered count
- [ ] ISC-8: Alert banner shows overdue cert count in red
- [ ] ISC-9: Alert banner shows due-soon cert count in amber (≤7 days)
- [ ] ISC-10: Tax cert tracker shows all contracts with cert status
- [ ] ISC-11: Tax cert tracker sorts overdue first, then due-soon, then upcoming, then received
- [ ] ISC-12: Each tracker row shows customer name, contract number, purchase date
- [ ] ISC-13: Each tracker row shows days remaining or overdue count
- [ ] ISC-14: Each tracker row shows colored status chip (red/amber/green/grey)
- [ ] ISC-15: Mark Received button calls PATCH /api/contracts/[id]/tax-exempt
- [ ] ISC-16: Mark Received button updates UI optimistically without page reload
- [ ] ISC-17: Sales grouped by show name for event sales
- [ ] ISC-18: Sales grouped by location name for store sales
- [ ] ISC-19: Each group header shows count, total revenue, deposits collected
- [ ] ISC-20: Each group is expandable/collapsible
- [ ] ISC-21: Each contract row shows customer name and phone
- [ ] ISC-22: Each contract row shows product name(s) from line_items JSONB
- [ ] ISC-23: Each contract row shows total, deposit paid, balance due
- [ ] ISC-24: Each contract row shows payment method chip
- [ ] ISC-25: Each contract row shows delivery status badge
- [ ] ISC-26: Each contract row links to /contracts/[id]
- [ ] ISC-27: Build passes TypeScript clean
- [ ] ISC-28: Page renders correctly for bookkeeper role

## Decisions

- Tax exempt tracking is per-contract (not per-customer) since exemption is per-purchase
- Cert tracking window: 30 days from contract created_at
- Bookkeeper gets a dedicated /bookkeeper route rather than modifying the shared dashboard
- SalesByEventList groups: if contract has show_id → group under show name; else group under location name

## Verification
