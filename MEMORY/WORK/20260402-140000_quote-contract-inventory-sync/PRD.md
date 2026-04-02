---
task: Sync quote contract fields with inventory data
slug: 20260402-140000_quote-contract-inventory-sync
effort: advanced
phase: complete
progress: 24/24
mode: interactive
started: 2026-04-02T14:00:00Z
updated: 2026-04-02T14:30:00Z
---

## Context

Three related problems:
1. Inventory picker was returning 0 results because all 524 seeded units have product_id=NULL, so the category filter (`product?.category === category`) always failed
2. No way to browse inventory from other locations — only current show/location
3. Cart showed shell color but not cabinet; no way to capture colors when skipping unit selection
4. Raw model codes ("C Bal 7") shown everywhere instead of clean product names

## Criteria

- [x] ISC-1: MODEL_CODE_CATEGORY_PREFIXES defined in inventory-constants for all 9 product lines
- [x] ISC-2: getCategoryForModelCode() helper resolves model_code prefix to DB category
- [x] ISC-3: MODEL_CODE_DISPLAY_NAMES maps raw codes to clean product-catalog names
- [x] ISC-4: getModelDisplayName() helper falls back to raw code if not in map
- [x] ISC-5: API GET /inventory adds model_code to SELECT fields
- [x] ISC-6: API category filter tries product?.category first, then getCategoryForModelCode fallback
- [x] ISC-7: API accepts all_locations=true param — skips location/show filter when set
- [x] ISC-8: InventoryUnit interface includes model_code field
- [x] ISC-9: Picker search includes unit.model_code and unit.product?.name
- [x] ISC-10: Picker search includes location name
- [x] ISC-11: Picker shows resolved model name (product.name ?? getModelDisplayName(model_code))
- [x] ISC-12: Picker shows cabinet color with getCabinetName() full name
- [x] ISC-13: Picker shows location city/state when in all-locations mode
- [x] ISC-14: Picker has "Show All Locations" toggle button
- [x] ISC-15: Picker empty state has "Search all locations →" link when not in all-locations mode
- [x] ISC-16: "Add Without Selecting a Unit" opens color-capture screen (not directly adds)
- [x] ISC-17: Color-capture screen has Shell Color and Cabinet Color dropdowns
- [x] ISC-18: Color-capture "Skip" option adds without colors
- [x] ISC-19: contractStore addLineItem accepts optional shell_color, cabinet_color params
- [x] ISC-20: contractStore has updateLineItemColors(index, shell, cabinet) action
- [x] ISC-21: Cart summary shows both shell AND cabinet colors on line items
- [x] ISC-22: Cart shows colors even for items added without a unit (color-only, no unit_id)
- [x] ISC-23: Admin inventory list uses getModelDisplayName() for units with no product_id
- [x] ISC-24: Admin inventory detail page title and product field use getModelDisplayName()

## Decisions

- getCategoryForModelCode uses prefix matching (longest-first order in array) since model_codes have consistent prefixes
- "All Locations" toggle refetches without any location filter rather than returning everything and filtering client-side
- Color capture shown as a separate screen (not inline) to keep the main picker uncluttered
- MODEL_CODE_DISPLAY_NAMES is a best-effort map; unknown codes fall back to raw model_code
- LSX → Michael Phelps Swim Spas (LSX = Legend Swim Spa X)

## Verification

- 524 units now findable by picker via model_code prefix matching
- All-locations toggle functional with location name + city/state shown
- Colors captured on skip flow and shown in cart for all spa line items
- 6 files changed: inventory-constants.ts, api/inventory/route.ts, InventoryUnitPicker.tsx, Step3Products.tsx, contractStore.ts, admin inventory pages
