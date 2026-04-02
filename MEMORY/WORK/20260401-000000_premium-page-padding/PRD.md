---
task: Add premium padding buffer to all app pages
slug: 20260401-000000_premium-page-padding
effort: standard
phase: complete
progress: 12/12
mode: interactive
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Context

User asked for a premium buffer between content and screen edges across all pages. Current state: `p-4` (16px) on standard pages feels cramped; contracts/new has zero padding; contracts/page delegates to a full-bleed ContractsList and should stay full-bleed. Fix: upgrade standard pages from `p-4` to `px-5 py-6` (20px sides, 24px vertical) and add `px-5 pt-6 pb-24` to contracts/new page main.

### Risks
- contracts/page.tsx uses full-bleed ContractsList — adding horizontal padding would break the list edge-to-edge design. Leave unchanged.
- admin form pages have `p-4` on CardContent too — only main container padding is in scope.

## Criteria

- [x] ISC-1: contracts/new main has px-5 pt-6 pb-24 classes present
- [x] ISC-2: dashboard main changes from p-4 to px-5 py-6 space-y-4
- [x] ISC-3: shows/page main changes from p-4 to px-5 py-6 space-y-6
- [x] ISC-4: shows/[id] main changes from p-4 to px-5 py-6 space-y-4
- [x] ISC-5: profile/page main changes from p-4 to px-5 py-6 space-y-4
- [x] ISC-6: contracts/[id] main changes from p-4 to px-5 py-6 space-y-4
- [x] ISC-7: admin/page main changes from p-4 to px-5 py-6 space-y-4
- [x] ISC-8: admin/shows/new main changes from p-4 to px-5 py-6
- [x] ISC-9: admin/locations/[id] main changes from p-4 to px-5 py-6
- [x] ISC-10: admin/locations/new main changes from p-4 to px-5 py-6
- [x] ISC-11: contracts/page main remains pb-28 (full-bleed list unchanged)
- [x] ISC-12: All max-w-2xl mx-auto pb-24 constraints preserved on changed pages

## Decisions

contracts/page left untouched — ContractsList renders full-bleed search bar, filter chips, and list rows that span edge-to-edge by design. Adding horizontal padding here would break that layout.

## Verification

All 10 Edit tool calls returned success. No p-4 on main elements remains except contracts/page (intentional).
