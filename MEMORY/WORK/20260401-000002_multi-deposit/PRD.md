---
task: Support multiple deposits collected on one order
slug: 20260401-000002_multi-deposit
effort: extended
phase: observe
progress: 18/18
mode: interactive
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Context

User needs to collect multiple partial payments on a single contract (e.g. $500 on CC now, $500 cash later). Currently: (1) button only shows when deposit_paid=0, (2) charge API overwrites deposit_paid instead of accumulating it, (3) collect-payment page and record-manual API don't exist.

### Risks
- deposit_paid must be SUM of all payments — fix overwrite bug first
- balance_due must always equal total - deposit_paid
- Contract status: "deposit_collected" when any payment made; "delivered" when balance_due=0 (future)
- Partial payments: user should be able to enter any amount up to balance_due

## Criteria

### Bug Fix — Payment Accumulation
- [ ] ISC-1: charge route updates deposit_paid as contract.deposit_paid + amount (not overwrite)
- [ ] ISC-2: charge route updates balance_due as contract.total - new_deposit_paid

### Bug Fix — Show Payment Button
- [ ] ISC-3: contract detail page shows payment button when balance_due > 0
- [ ] ISC-4: button label says "Collect Deposit" if no prior payments, "Add Payment" if payments exist

### New Route — record-manual
- [ ] ISC-5: POST /api/payments/record-manual route created
- [ ] ISC-6: Route verifies auth before proceeding
- [ ] ISC-7: Route accepts contract_id, amount, method, check_number, bank_name
- [ ] ISC-8: Route inserts payment row with status completed
- [ ] ISC-9: Route accumulates deposit_paid and recalculates balance_due on contract

### New Page — collect-payment
- [ ] ISC-10: /contracts/[id]/collect-payment/page.tsx created
- [ ] ISC-11: Page shows contract total, amount already paid, balance remaining
- [ ] ISC-12: Amount input defaults to full balance_due, can be edited to less
- [ ] ISC-13: Payment method selector (credit_card, debit_card, ach, cash)
- [ ] ISC-14: CC surcharge shown when credit_card selected and surcharge_enabled
- [ ] ISC-15: Card payment calls /api/payments/charge
- [ ] ISC-16: ACH/cash payment calls /api/payments/record-manual
- [ ] ISC-17: Success state shows amount collected and new balance_due
- [ ] ISC-18: Back navigation returns to contract detail page

## Decisions

## Verification
