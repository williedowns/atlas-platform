---
task: Merge Google Sheets inventory data into app
slug: 20260402-120000_merge-inventory-spreadsheet-data
effort: comprehensive
phase: complete
progress: 12/12
mode: interactive
started: 2026-04-02T12:00:00Z
updated: 2026-04-02T13:00:00Z
---

## Context
22-tab Google Sheets workbook tracking 524+ active inventory units across 9 locations.
Color key (KEY tab) encodes delivery team and payment status via cell background colors.
Goal: fully migrate all unit data + color semantics into the app database.

## Criteria
- [x] ISC-1: Excel file parsed and all 22 sheet tabs identified
- [x] ISC-2: KEY tab color meanings decoded (6 colors → delivery/payment flags)
- [x] ISC-3: 524 units extracted with sheet, model, serial, shell, cabinet, wrap, status, notes
- [x] ISC-4: Color data extracted per row (delivery_team, payment_flag, scheduled_owes)
- [x] ISC-5: Migration 006 adds delivery_team, customer_name, fin_balance, model_code columns
- [x] ISC-6: Migration 007 seeds all 9 locations as location records
- [x] ISC-7: Migration 007 seeds all 524 inventory units with correct status mapping
- [x] ISC-8: Spreadsheet status → DB status mapping (Stock→at_location, Sold→allocated, etc.)
- [x] ISC-9: Unit type inferred from notes (wet model, blem, floor model, stock)
- [x] ISC-10: Admin inventory table shows model_code, delivery team badge, customer, fin_balance
- [x] ISC-11: Unit detail page shows Customer & Delivery card for legacy sold units
- [x] ISC-12: PATCH API + UnitDetailActions form include delivery_team/customer_name/fin_balance fields

## Decisions
- delivery_team stores raw team assignment from color key: atlas | fierce | houston_aaron
- model_code stores abbreviated model from spreadsheet (e.g. "LSX 800") when product_id unresolved
- Factory and Spas On Order units get NULL location_id (not physically at a showroom yet)
- Sold units from spreadsheet marked allocated status; customer stored in customer_name until linked to contract

## Verification
- 524 units extracted from 17 active sheets (8 empty rows skipped)
- 9 location upserts cover all showrooms
- Color badges in admin table: cyan=Atlas, purple=Fierce, orange=HOU/Aaron
- fin_balance "PIF" renders as green badge, dollar amounts as amber, text as slate
