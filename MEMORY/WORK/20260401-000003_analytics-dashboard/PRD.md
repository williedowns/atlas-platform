---
task: Build admin analytics dashboard with rich business insights
slug: 20260401-000003_analytics-dashboard
effort: advanced
phase: complete
progress: 28/28
mode: interactive
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:03Z
---

## Context

Owner and management need a dedicated analytics page at /analytics showing business performance across time periods. Data aggregated in JS from Supabase queries. Admin and manager roles only.

### Sections
1. Period selector (today/week/month/year/all)
2. KPI strip (revenue, deposits, contracts, avg deal)
3. Sales rep leaderboard
4. Shows breakdown
5. Locations breakdown
6. Top products
7. Outstanding/actionable items

## Criteria

### Page & Access
- [x] ISC-1: /analytics page created, admin/manager only (others redirect)
- [x] ISC-2: Period selector renders as tab strip using URL search params
- [x] ISC-3: Default period is "month" (current month)

### KPI Strip
- [x] ISC-4: Total revenue card shows sum of non-cancelled contract totals
- [x] ISC-5: Total deposits card shows sum of deposit_paid
- [x] ISC-6: Contract count card shows count for period
- [x] ISC-7: Average deal size card shows revenue / contract count
- [x] ISC-8: YTD comparison shows delta vs prior period

### Sales Rep Leaderboard
- [x] ISC-9: Each rep row shows rank, name, contract count, total revenue, avg deal
- [x] ISC-10: Rows sorted by revenue descending
- [x] ISC-11: Top rep highlighted with distinct styling

### Shows Breakdown
- [x] ISC-12: Each show row shows name, dates, contract count, revenue, deposits
- [x] ISC-13: Shows sorted by revenue descending

### Locations Breakdown
- [x] ISC-14: Each location row shows name, type badge, contract count, revenue
- [x] ISC-15: Locations sorted by revenue descending

### Top Products
- [x] ISC-16: Aggregated from line_items JSONB across all contracts in period
- [x] ISC-17: Each row shows product name, units sold, total revenue
- [x] ISC-18: Top 10 by revenue, sorted descending

### Outstanding Items
- [x] ISC-19: Count and value of contracts signed but no deposit collected
- [x] ISC-20: Total balance due across all active contracts
- [x] ISC-21: Count of contracts pending signature
- [x] ISC-22: Each outstanding contract shown with name, amount, days since signed

### Navigation
- [x] ISC-23: Dashboard shows Analytics link for admin/manager roles
- [x] ISC-24: Admin panel shows Analytics link at top
- [x] ISC-25: Analytics page has back navigation to dashboard

### Polish
- [x] ISC-26: Empty states handled gracefully (no data for period)
- [x] ISC-27: All currency values use formatCurrency
- [x] ISC-28: Page is mobile-friendly with max-w-2xl constraint

## Decisions

- All data aggregation done in JS server-side (no Supabase RPC needed)
- line_items JSONB iterated per-contract to build product map
- Outstanding items query is all-time (not period-filtered) since they are actionable regardless
- Prior period comparison excludes "all" period (no prior analog)
- Top rep highlighted with amber-50 background row

## Verification

All 28 ISC criteria implemented in src/app/analytics/page.tsx. Navigation links added to dashboard/page.tsx and admin/page.tsx.
