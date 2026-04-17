# QuickBooks Online — Accounting Setup Guide

This guide walks through configuring QBO for Atlas Spas' Salta integration, covering **both** supported deposit workflows:

- **Income mode** (default, Lori's current workflow): deposits post to income accounts
- **Liability mode** (target accrual workflow): deposits post to Customer Deposits liability account, revenue recognized at delivery

The **config flag** `QBO_DEPOSIT_MODE` chooses which workflow Salta uses at runtime. You can pre-configure both workflows' QBO items on every location/show, then flip the flag when Ian and Lori are ready.

---

## The Config Flag — Short Version

Set one environment variable in Atlas:

```
QBO_DEPOSIT_MODE=income      # Lori's current workflow (safe default for go-live)
QBO_DEPOSIT_MODE=liability   # Target accrual workflow (requires CPA + bookkeeper sign-off)
```

If unset, defaults to `income`.

---

## 1. Chart of Accounts Setup

### 1A. Income Mode (Lori's current workflow)

Use your existing income accounts. No new accounts needed. Lori's current practice is to book deposits directly to location-specific sales income accounts (e.g., `Sales - Tyler`, `Sales - Canton`, etc.).

### 1B. Liability Mode (target accrual workflow — for future)

Create a parent Customer Deposits liability account with per-location sub-accounts:

1. In QBO, go to **Settings (gear icon)** > **Chart of Accounts**
2. Click **New**
3. Create the parent account:
   - **Account Type**: Other Current Liabilities
   - **Detail Type**: Other Current Liabilities (if "Customer Deposits" isn't available)
   - **Name**: `Customer Deposits`
4. Save
5. Create sub-accounts for each location (Tyler, Canton, Wills Point, Shows):
   - **Account Type**: Other Current Liabilities
   - **Name**: `Customer Deposits - Tyler` (etc.)
   - Check **Is sub-account** → parent: Customer Deposits
6. Save

Final Chart of Accounts structure:
```
Customer Deposits (Other Current Liabilities)
  ├── Customer Deposits - Tyler
  ├── Customer Deposits - Canton
  ├── Customer Deposits - Wills Point
  └── Customer Deposits - Shows
```

---

## 2. Create QBO Items for Each Mode

You need **two sets of items** — one pointing to income accounts (for income mode), one pointing to liability accounts (for liability mode). Pre-configuring both lets you flip the `QBO_DEPOSIT_MODE` flag at any time without touching QBO.

### 2A. Income Mode Items (for Lori's current workflow)

For each location/show, create a deposit item mapped to the appropriate **income** account:

1. Go to **Sales** > **Products and Services**
2. Click **New** > **Non-inventory item** (or Service)
3. Fill in:
   - **Name**: `Deposit (Income) - [Location]` (e.g., `Deposit (Income) - Tyler`)
   - **Sales** section:
     - Check "I sell this to my customers"
     - **Income account**: The existing income account for this location (e.g., `Sales - Tyler`)
   - **Sales tax category**: Non-taxable (deposits aren't taxable)
4. Save
5. **Note the Item ID** — click back into the item, check URL: `…/app/item?id=XXX`

Repeat for each location (Tyler, Canton, Wills Point) and Shows.

### 2B. Liability Mode Items (for target accrual workflow)

For each location/show, create a deposit item mapped to the **liability** sub-account:

1. Go to **Sales** > **Products and Services**
2. Click **New** > **Non-inventory item** (or Service)
3. Fill in:
   - **Name**: `Deposit - [Location]` (e.g., `Deposit - Tyler`)
   - **Sales** section:
     - Check "I sell this to my customers"
     - **Income account**: The liability sub-account (e.g., `Customer Deposits - Tyler`) — NOT an income account
   - **Sales tax category**: Non-taxable
4. Save
5. **Note the Item ID**

> **Note:** QBO labels the dropdown "Income account" even when you're mapping to a liability account. This is a QBO UI quirk — the actual account type is determined by the account you select, not the label.

---

## 3. Configure Per-Location Item IDs in Atlas

For each location and show in Atlas, enter both Item IDs:

1. Go to **Admin** > **Locations** > click a location (or **Admin** > **Shows** > click a show)
2. Scroll to **QuickBooks Deposit Items** section
3. Enter:
   - **Income Item ID**: The income-mapped item ID from Step 2A
   - **Income Item Name**: Human-readable label for reference
   - **Liability Item ID**: The liability-mapped item ID from Step 2B
   - **Liability Item Name**: Human-readable label for reference
4. Save

Repeat for every location/show. Once done, flipping between modes is a one-line env var change.

---

## 4. Set Up QBO Departments (Locations)

QBO Departments allow tracking by physical location for reporting and tax purposes. This works the same in both modes.

1. Go to **Settings** > **Account and Settings** > **Advanced**
2. Under **Categories**, enable **Track locations** (QBO calls them "Locations" in settings, "Departments" in the API)
3. Create entries for each store/show:
   - Tyler Store
   - Canton Store
   - Wills Point
   - Shows (or individual show venues)
4. **Get Department IDs**: Use the QBO API or check the URL when editing — `?id=XXX`
5. In Atlas admin, set the Department ID on each location/show record

---

## 5. Environment Variables Summary

| Variable | Purpose | Required |
|----------|---------|----------|
| `QBO_CLIENT_ID` | OAuth client ID from Intuit Developer Portal | Yes |
| `QBO_CLIENT_SECRET` | OAuth client secret | Yes |
| `QBO_SANDBOX` | Set to `"true"` for sandbox testing | No |
| `QBO_DEPOSIT_MODE` | `income` (default) or `liability` | Recommended |
| `QBO_DEPOSIT_INCOME_ITEM_ID` | Global fallback item ID (if not set per-location) | Optional |
| `QBO_DEPOSIT_LIABILITY_ITEM_ID` | Global fallback item ID (if not set per-location) | Optional |
| `QBO_DEPOSIT_ITEM_ID` | Legacy item ID (used if mode-specific vars unset) | Deprecated |
| `QBO_DEFAULT_SALES_ITEM_ID` | Fallback item for product line items without QBO mapping | Recommended |
| `QBO_CUSTOMER_DEPOSITS_ACCOUNT_ID` | Bank account for deposit receipts | Optional |

### Resolution Order

The deposit item ID is selected in this priority order:

1. Per-location/per-show item ID (set in Admin UI) for the current mode
2. Global env var (`QBO_DEPOSIT_INCOME_ITEM_ID` or `QBO_DEPOSIT_LIABILITY_ITEM_ID`)
3. Legacy `QBO_DEPOSIT_ITEM_ID`
4. If none found: error thrown with diagnostic message

---

## 6. How It Works in Each Mode

### Income Mode (default — Lori's current workflow)

**When a deposit is collected:**
1. Salta creates a QBO **SalesReceipt** using the **income-mapped item**
2. This **debits the bank account** and **credits the income account**
3. Revenue is recognized immediately (cash-basis treatment)
4. Lori reconciles as she does today — no workflow change for her

**When a hot tub is delivered:**
- No additional QBO entry for deposit recognition (already booked as income)
- Balance due (if any) can be collected via another SalesReceipt or Invoice
- Avalara commits tax transaction

### Liability Mode (target accrual workflow — future)

**When a deposit is collected:**
1. Salta creates a QBO **SalesReceipt** using the **liability-mapped item**
2. This **debits the bank account** and **credits the liability sub-account**
3. Revenue is NOT recognized yet (matches GAAP accrual)

**When a hot tub is delivered:**
1. Salta creates a QBO **Invoice** with all line items at full price
2. This **recognizes revenue** on the income accounts
3. Salta creates a QBO **Payment** applying accumulated deposits against the invoice
4. This **debits the liability account** (reducing it) and **credits Accounts Receivable**
5. Balance due (if any) is collected
6. Avalara commits tax transaction

### Net effect of liability mode:
- Deposits sit in liability until delivery
- Revenue is recognized only at delivery (GAAP compliant)
- Per-location P&L is clean without manual journal entries
- Sales tax is filed at delivery (via Avalara) when the taxable event occurs

---

## 7. Transition Plan: Income → Liability Mode

**Do NOT flip this flag without Ian's explicit sign-off and Lori's training.**

Recommended transition (per Ian Allena's April 13, 2026 guidance):

1. **Phase 1 — ship income mode.** Go live with `QBO_DEPOSIT_MODE=income`. Both sets of QBO items pre-configured but only income items in use.
2. **Phase 2 — design working session.** Ian + Lori + Mike + Willie map the full accrual-based order-to-cash workflow. Document target chart of accounts and timing.
3. **Phase 3 — pilot.** Pick a cutover date (ideally fiscal quarter start). Train Lori on new reconciliation. Ian on-call for first 30 days.
4. **Phase 4 — flip the flag.** Change env var to `QBO_DEPOSIT_MODE=liability`. Monitor daily for first week, weekly for first month.
5. **Phase 5 — full cutover.** After 90 days, legacy income-mode items can be deactivated in QBO if no longer needed.

---

## 8. Troubleshooting

### Error: "QBO deposit item not configured for mode=income"
- The location/show record has no `qbo_deposit_income_item_id` AND the env var `QBO_DEPOSIT_INCOME_ITEM_ID` is not set
- Fix: set the item ID on the location in Admin, or set the global env var

### Error: "QBO deposit item not configured for mode=liability"
- Same as above, but for liability mode
- Fix: set `qbo_deposit_liability_item_id` per-location or `QBO_DEPOSIT_LIABILITY_ITEM_ID` env var

### Deposits showing up in wrong account after flag flip
- Verify the mode-specific item IDs point to the right QBO accounts
- Income items → income accounts
- Liability items → Customer Deposits liability sub-accounts
- Use QBO "Audit Log" on the item to confirm its income account mapping
