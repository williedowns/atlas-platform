---
task: Build show-ready features for Thursday deadline
slug: 20260402-140000_show-readiness
effort: comprehensive
phase: execute
progress: 0/64
mode: interactive
started: 2026-04-02T14:00:00Z
updated: 2026-04-02T14:00:00Z
---

## Context

First show is next Thursday. Priority items: audit trail, reconciliation view, welcome email, legal signature, customer portal foundation. Role-based dashboards and full customer portal payments are post-Thursday.

### Thursday Priority Build
1. Git feature branches
2. Audit trail (migration + lib + integrations)
3. Legal signature enhancement (IP + consent + metadata)
4. Welcome email trigger post-signing
5. Reconciliation view for Lori
6. Customer portal foundation (skeleton + login)

## Criteria

### Git & Process
- [ ] ISC-1: feature/audit-trail branch created from main
- [ ] ISC-2: feature/legal-signature branch created from main
- [ ] ISC-3: feature/welcome-email branch created from main
- [ ] ISC-4: feature/customer-portal branch created from main
- [ ] ISC-5: feature/reconciliation branch created from main

### Audit Trail
- [ ] ISC-6: Migration 011 creates audit_logs table with correct columns
- [ ] ISC-7: audit_logs has user_id, action, entity_type, entity_id fields
- [ ] ISC-8: audit_logs has ip_address, user_agent, metadata jsonb, created_at
- [ ] ISC-9: src/lib/audit.ts logAction helper function created
- [ ] ISC-10: Contract creation logs audit entry
- [ ] ISC-11: Contract signing logs audit entry
- [ ] ISC-12: Payment collection logs audit entry
- [ ] ISC-13: Status change logs audit entry
- [ ] ISC-14: Admin can view audit log on contract detail page

### Legal Signature Enhancement
- [ ] ISC-15: Electronic consent checkbox added before signature pad
- [ ] ISC-16: Checkbox must be checked before Sign button is enabled
- [ ] ISC-17: Legal disclosure paragraph with proper language added
- [ ] ISC-18: IP address captured server-side on contract creation
- [ ] ISC-19: User agent captured server-side on contract creation
- [ ] ISC-20: signature_metadata stored on contracts record (jsonb column)
- [ ] ISC-21: Migration 012 adds signature_metadata column to contracts

### Welcome Email
- [ ] ISC-22: Welcome email sent automatically after contract created
- [ ] ISC-23: Email includes customer name and purchase summary
- [ ] ISC-24: Email includes link to customer portal
- [ ] ISC-25: Email includes instructions to create account
- [ ] ISC-26: Email is warm Atlas brand tone with logo
- [ ] ISC-27: RESEND_API_KEY env var documented clearly

### Reconciliation View
- [ ] ISC-28: Reconciliation section added to bookkeeper dashboard
- [ ] ISC-29: Shows deposits grouped by payment method per location/show
- [ ] ISC-30: Columns: Cash, Credit Card, ACH, Financing, Total
- [ ] ISC-31: Per-row shows location/show name and date range
- [ ] ISC-32: Grand total row at bottom
- [ ] ISC-33: Reconciliation separate from tax cert tracker section

### Customer Portal Foundation
- [ ] ISC-34: /portal route created
- [ ] ISC-35: /portal/login page with email/password auth
- [ ] ISC-36: Customer role restricted to portal only
- [ ] ISC-37: /portal/dashboard shows customer's contracts list
- [ ] ISC-38: /portal/contract/[id] shows contract detail view
- [ ] ISC-39: Contract detail shows signed PDF download link
- [ ] ISC-40: Contract detail shows order status with timeline
- [ ] ISC-41: Upload cert button on contract detail page
- [ ] ISC-42: Upload triggers tax_exempt_cert_received = true on contract
- [ ] ISC-43: Upload notifies bookkeeper (log + email to Lori)
- [ ] ISC-44: Portal uses Atlas branding (teal, Figtree font, logo)
- [ ] ISC-45: Customer cannot access internal /dashboard or /contracts routes

### Role-Based Dashboards
- [ ] ISC-46: Sales rep dashboard shows today's contracts at current show
- [ ] ISC-47: Sales rep dashboard shows personal total for current show
- [ ] ISC-48: Manager dashboard shows all reps, all contracts, show totals
- [ ] ISC-49: Manager dashboard shows financing breakdown
- [ ] ISC-50: Each role redirected to correct dashboard on login

### Build Quality
- [ ] ISC-51: All TypeScript compiles clean
- [ ] ISC-52: No breaking changes to existing contract flow
- [ ] ISC-53: Existing payments continue to work

## Decisions

- Legal signature: enhanced canvas + IP/timestamp/consent (not HelloSign) for Thursday; HelloSign upgrade post-show
- Welcome email: trigger immediately in /api/contracts POST route after contract saved; use existing Resend integration
- Portal auth: Supabase auth with customer role; portal at /portal/* routes
- Cert upload: Supabase Storage bucket "tax-certs"; mark contract + email Lori

## Verification
