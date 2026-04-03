---
task: Collapse product line and model sections after selection
slug: 20260402-120000_collapse-product-sections
effort: standard
phase: complete
progress: 10/10
mode: interactive
started: 2026-04-02T12:00:00Z
updated: 2026-04-02T12:00:00Z
---

## Context

Step3Products.tsx shows all product line grids and full model lists at once, making the form long and hard to navigate on iPad. State variables `lineCollapsed` and `modelCollapsed` were already added but JSX not yet updated to use them.

### Task
1. After selecting a product line, collapse the line picker grid → show a compact "Selected: Clarity Series [Change]" row
2. After selecting a model (adding to cart), collapse the model list → show compact "Model added ✓ [Change]" row
3. After model selected, auto-show the Add-Ons section (already wired via `setShowOptions(true)` in `collapseAfterModelAdd`)

## Criteria

- [x] ISC-1: Product line grid collapses when line is selected
- [x] ISC-2: Collapsed line shows selected line logo and name
- [x] ISC-3: Collapsed line shows "Change" button to re-expand
- [x] ISC-4: Clicking "Change" on line expands the full grid again
- [x] ISC-5: Model list section hidden when modelCollapsed is true
- [x] ISC-6: Collapsed model row shows confirmation text and Change button
- [x] ISC-7: Clicking "Change" on model re-expands model list
- [x] ISC-8: Add-ons section auto-opens after model selection
- [x] ISC-9: Changing product line resets modelCollapsed to false
- [x] ISC-10: No TypeScript errors — build passes clean

## Decisions

## Verification
