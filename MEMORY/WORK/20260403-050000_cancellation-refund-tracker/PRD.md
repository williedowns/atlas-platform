---
task: Cancellation refund tracker for bookkeeper page
slug: 20260403-050000_cancellation-refund-tracker
effort: standard
phase: execute
progress: 14/14
mode: interactive
started: 2026-04-03T05:00:00Z
updated: 2026-04-03T05:05:00Z
---

## Context

Bookkeeper (Lori) needs visibility into cancelled contracts that have deposits requiring manual refunds in QuickBooks. Currently nothing alerts her when a contract is cancelled with a paid deposit. Solution: query cancelled contracts with deposit_paid > 0, show them in a collapsible alert section on the bookkeeper page with a "Mark Refunded in QB" action per row. Use the contract notes field as a persistent processed marker — no DB migration needed.

## Criteria

- [x] ISC-1: Bookkeeper page queries cancelled contracts with deposit_paid > 0
- [x] ISC-2: CancellationRefundTracker component renders on bookkeeper page
- [x] ISC-3: Component shows red alert header when pending refunds exist
- [x] ISC-4: Header displays count of pending refunds as badge
- [x] ISC-5: Component is collapsible (expanded by default when items exist)
- [x] ISC-6: Each row shows customer name and contract number
- [x] ISC-7: Each row shows cancellation date
- [x] ISC-8: Each row shows deposit paid amount prominently
- [x] ISC-9: Each row shows refund amount extracted from notes (or deposit amount)
- [x] ISC-10: Each row shows a Mark Refunded in QB button
- [x] ISC-11: Mark Refunded button calls POST /api/contracts/[id]/mark-refunded
- [x] ISC-12: API route appends REFUND PROCESSED IN QB marker to contract notes
- [x] ISC-13: After marking, row disappears from pending list (optimistic UI update)
- [x] ISC-14: When all refunds processed, section shows green all-clear state

## Decisions

- Processed marker: notes field appended with `\nREFUND PROCESSED IN QB: {date}` — persists across page reloads, no migration
- Refund amount display: parse `Refund of $X.XX` from notes; fall back to deposit_paid
- Placement: above ReconciliationView, below tax cert tracker — action items first

## Verification
