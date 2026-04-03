---
task: Pre-launch improvements for Atlas Spas platform
slug: 20260403-040000_prelaunch-improvements
effort: advanced
phase: build
progress: 0/28
mode: interactive
started: 2026-04-03T04:00:00Z
updated: 2026-04-03T04:05:00Z
---

## Context

Pre-launch hardening pass for the Atlas Spas PWA. User is launching in a few days and wants a reliability/usability pass overnight. Key areas: inventory management correctness (cancel route sets wrong status), accidental tap protection (no confirmation on destructive actions in contract builder), contracts list UX improvements (date quick filters, row limit warning), and infrastructure hygiene (SW cache auto-versioning, rate limiting on payment endpoints).

### Risks
- Step3Products confirmation state must use index-based tracking (not product ID) since same product can appear multiple times
- Cancel route status: `available` vs `at_location` — InventoryUnitPicker only fetches `at_location,at_show` so units cancelled back to `available` are invisible
- Date quick filters must work client-side (data already loaded) without a full server refetch
- SW postbuild script must run after `.next/BUILD_ID` is generated (postbuild hook)
- Rate limiting: must work per-IP across serverless invocations — in-memory won't survive cold starts; use a lightweight approach (headers + supabase rate check or simple edge check)

### Plan
1. Cancel route: 1-line fix `available` → `at_location`
2. Step3Products: add `pendingRemoveIdx`/`pendingRemoveDiscountIdx` state, two-step confirm UI
3. ContractsList: add date quick filters (Today/Week/Month) client-side; add 200-row limit banner
4. SW auto-versioning: postbuild script reads `.next/BUILD_ID`, writes to `public/sw.js`
5. Rate limiting: simple in-memory Map with timestamp tracking on charge route
6. contracts/page.tsx: show count indicator when at limit

## Criteria

- [x] ISC-1: Cancel route sets inventory unit status to at_location not available
- [x] ISC-2: Cancel route clears contract_id from released units
- [x] ISC-3: Line item remove in Step3 shows inline confirm before deleting
- [x] ISC-4: Line item confirm state resets if user taps elsewhere or different item
- [x] ISC-5: Discount remove in Step3 shows inline confirm before deleting
- [x] ISC-6: Discount confirm state resets cleanly after cancel
- [x] ISC-7: ContractsList has Today quick filter button
- [x] ISC-8: ContractsList has This Week quick filter button
- [x] ISC-9: ContractsList has This Month quick filter button
- [x] ISC-10: Date quick filters combine correctly with status filter chips
- [x] ISC-11: Date quick filters combine correctly with text search
- [x] ISC-12: Active date filter is visually highlighted same style as status chips
- [x] ISC-13: Contracts page shows warning banner when 200-row limit is reached
- [x] ISC-14: Warning banner text explains there may be more contracts not shown
- [x] ISC-15: SW postbuild script reads .next/BUILD_ID file
- [x] ISC-16: SW postbuild script writes updated CACHE_NAME containing build ID to sw.js
- [x] ISC-17: package.json postbuild script entry runs the update script
- [x] ISC-18: Rate limiting applied to /api/payments/charge route
- [x] ISC-19: Rate limit is per-IP address extracted from request headers
- [x] ISC-20: Rate limited requests return 429 with clear error message
- [x] ISC-21: Rate limit window is 60 seconds with max 15 requests
- [x] ISC-22: Rate limit does not block legitimate burst during normal checkout flow
- [x] ISC-23: Step3 line item remove confirm button is clearly destructive red style
- [x] ISC-24: Step3 line item remove has cancel option to dismiss confirm state
- [x] ISC-25: ContractsList date filter All button resets to show all dates
- [x] ISC-26: InventoryUnitPicker already has search — no change needed (verified)
- [x] ISC-27: Tax calculation already debounced 500ms — no change needed (verified)
- [ ] ISC-28: TypeScript compiles without new errors after all changes

## Decisions

## Verification
