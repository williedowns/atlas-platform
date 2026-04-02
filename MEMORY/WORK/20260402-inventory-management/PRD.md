---
task: Design inventory system for Atlas Spas app
slug: 20260402-inventory-management
effort: comprehensive
phase: execute
progress: 0/11
mode: interactive
started: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:01:00Z
---

# Context
21-tab Google Spreadsheet tracks ~500+ active units across 9 locations.
Paper contract shows unit identification: New/In-Stock/Floor/Blem + serial + shell + cabinet.
Current app has basic products + inventory_units tables with no UI.

# What We're Building
1. Migration 005 — expand inventory schema
2. Shared inventory constants (colors, lines, statuses)
3. Types update — InventoryUnit, ContractLineItem expansions
4. /inventory page — sales rep mobile browser
5. /admin/inventory page — admin management
6. /admin/inventory/new — add unit form
7. /admin/inventory/[id] — unit detail/edit/transfer
8. InventoryUnitPicker component
9. Step3Products update — inventory picker integration
10. Admin page — add inventory link
11. Store update — inventory_unit_id in line items

# Criteria
- [ ] ISC-1: Migration adds shell_color, cabinet_color, unit_type, show_id to inventory_units
- [ ] ISC-2: Migration adds inventory_transfers table with full audit fields
- [ ] ISC-3: Migration makes serial_number nullable (on_order units have no serial yet)
- [ ] ISC-4: Products gain line and model_code fields
- [ ] ISC-5: /inventory page shows units at rep's show/location
- [ ] ISC-6: /admin/inventory shows all units with location filter
- [ ] ISC-7: Add unit form captures all 15 spreadsheet fields
- [ ] ISC-8: Unit detail page supports transfer to another location/show
- [ ] ISC-9: InventoryUnitPicker shows available units filtered to current show
- [ ] ISC-10: Step3Products shows unit picker button for spa products
- [ ] ISC-11: Selecting a unit pre-fills serial, shell, cabinet, unit_type on line item
