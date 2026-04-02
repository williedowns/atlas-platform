---
task: Audit and fix inventory data completeness gaps
slug: 20260402-130000_audit-inventory-data-completeness
effort: advanced
phase: complete
progress: 12/12
mode: interactive
started: 2026-04-02T13:00:00Z
updated: 2026-04-02T13:15:00Z
---

## Context

After 524 inventory units were seeded from the Google Sheets workbook, the user identified that
significant spreadsheet data was not reflected in the app. This task audits all 15 columns from
the original spreadsheet against the inventory_units schema and generates migration + backfill SQL
to close every gap.

**Spreadsheet columns vs DB mapping:**
| Column | DB Field | Status |
|---|---|---|
| Last Name + First Name | customer_name | ✅ Stored (combined) |
| Wrap | wrap_status | ✅ Stored |
| Line | (empty in sheet) | — Nothing to store |
| Model | model_code | ✅ Stored |
| Shell | shell_color | ✅ Stored |
| Cabinet | cabinet_color | ✅ Stored |
| Serial # | serial_number / order_number | ✅ Stored |
| Location | location_id | ✅ Stored |
| **Completed** | **delivery_info** | ✅ Added (migration 008+009) |
| Status | status | ✅ Stored |
| Fierce Notes | notes (prefixed) | ✅ Stored |
| Fin Bal | fin_balance | ✅ Stored |
| Atlas Notes | notes (prefixed) | ✅ Stored |
| Expo Team Notes | notes (prefixed) | ✅ Stored |
| Delivery team (cell color) | delivery_team | ✅ Stored |
| PIF flag (cell color) | fin_balance=PIF | ✅ Stored |
| **Foundation Financing (cell color)** | **foundation_financing** | ✅ Added |
| **Scheduled Owes (cell color)** | **scheduled_owes** | ✅ Added |

### Risks
- 89 no-serial records (Spas On Order) cannot be matched for backfill; data gaps remain for those
- delivery_info "completed" field is freeform text — dates, truck dates, add-on abbreviations

## Criteria

- [x] ISC-1: Audit all 15 spreadsheet columns vs current DB schema
- [x] ISC-2: Identify `completed` field as unmapped (403 records with data)
- [x] ISC-3: Identify `foundation_financing` flag as unmapped (51 records)
- [x] ISC-4: Identify `scheduled_owes` flag as unmapped (30 records)
- [x] ISC-5: Confirm `line` column is empty in spreadsheet (0% populated — no action needed)
- [x] ISC-6: Migration 008 adds `delivery_info text` column to inventory_units
- [x] ISC-7: Migration 008 adds `foundation_financing boolean default false` column
- [x] ISC-8: Migration 008 adds `scheduled_owes boolean default false` column
- [x] ISC-9: Migration 009 UPDATE SQL generated for 404 serial-matched records
- [x] ISC-10: Admin inventory list shows `delivery_info`, FF badge, scheduled_owes warning
- [x] ISC-11: Unit detail page shows `delivery_info`, FF badge, scheduled_owes badge
- [x] ISC-12: PATCH API and UnitDetailActions form include all 3 new fields

## Decisions

- `delivery_info` stores raw "Completed" column text: truck dates ("Trk 3-26-26"), ISO delivery dates,
  add-on abbreviations (SALT, WiFi, ST=salt treatment), storage notes, USED/SWAP info
- `foundation_financing` is a boolean extracted from cell background color in the spreadsheet KEY tab
- `scheduled_owes` is a boolean — customer has a scheduled delivery but outstanding balance owed
- No-serial records (Spas On Order, 89 records) skipped in backfill — cannot be uniquely matched

## Verification

- 404 UPDATE rows generated in migration 009 (matching 443 serial records, 39 with nothing to update)
- 51 foundation_financing records, 30 scheduled_owes records covered in backfill SQL
- All 4 code files updated: list page, detail page, UnitDetailActions, PATCH API route
