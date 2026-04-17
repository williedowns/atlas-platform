# Salta Platform — Competitive Improvement Plan

**Based on:** Salta vs. Evosus Lou Competitive Analysis (April 10, 2026)
**Prepared:** April 13, 2026
**Status:** Planning — awaiting approval before execution

---

## Executive Summary

The competitive analysis identifies **5 critical gaps** where Evosus Lou has decisive advantages that hot tub/swim spa dealers expect from any platform. This plan closes those gaps in three phases over 12-18 months while preserving Salta's existing advantages (modern architecture, contract builder, Avalara integration, trade show management, customer portal).

**Important constraint from Ian Allena (CPA):** The QBO accounting automation (deposits → liability → revenue at delivery) must NOT go live until the full accrual-based order-to-cash process is mapped with Ian, Lori, and Mike. This does not block any Phase 1 competitive features below — it's a parallel workstream.

---

## Current Competitive Position

| Area | Salta | Lou | Status |
|------|-------|-----|--------|
| Architecture & Tech Stack | Next.js 16, React 19, PWA | Older web app | **Ahead** |
| Contract Builder | 6-step guided workflow | Basic form | **Ahead** |
| Tax Compliance (Avalara) | Real-time + commit at delivery | Basic estimate | **Ahead** |
| Digital Signatures | Native signature pad | Not available | **Ahead** |
| Trade Show Management | Full show lifecycle | Not available | **Ahead** |
| Customer Portal | Service requests, equipment | Limited | **Ahead** |
| Field Service Mobile | Basic crew dashboard | Dedicated native app | **Gap** |
| Service Scheduling | Read-only calendar | Drag-and-drop scheduler | **Gap** |
| Card on File / Mass Pay | One-time charges only | Stored payments + batch | **Gap** |
| Route Optimization | Not built | Google Maps integrated | **Gap** |
| Purchase Orders | Not built | Full PO lifecycle | **Gap** |
| Retail POS | Not built | Full module | **Gap** |

---

## Phase 0: Shared Infrastructure (Weeks 1-2)

Before building any Phase 1 features, these database migrations and shared utilities must be in place. They are dependencies for multiple features.

### Migrations Required

**Migration 032: Field crew PIN authentication**
```
field_crew_pins
├── profile_id (uuid FK → profiles, UNIQUE)
├── pin_hash (text, bcrypt)
├── failed_attempts (int, default 0)
├── locked_until (timestamptz)
└── created_at (timestamptz)
```

**Migration 033: Service job enhancements**
```
ALTER TABLE service_jobs ADD:
├── check_in_at (timestamptz)
├── check_out_at (timestamptz)
├── check_in_lat (numeric 10,7)
├── check_in_lng (numeric 10,7)
├── check_out_lat (numeric 10,7)
├── check_out_lng (numeric 10,7)
├── time_on_site_minutes (int)
├── lane_order (int)
├── estimated_duration_minutes (int, default 60)
├── drive_time_minutes (int)
├── drive_distance_miles (numeric 6,1)
└── route_order (int)

ALTER TABLE profiles ADD:
└── tech_color (text) -- hex color for scheduler lane
```

**Migration 034: Customer geocoding**
```
ALTER TABLE customers ADD:
├── lat (numeric 10,7)
├── lng (numeric 10,7)
└── geocoded_at (timestamptz)
```

**Migration 035: Customer payment methods**
```
customer_payment_methods
├── id (uuid PK)
├── customer_id (uuid FK → customers)
├── type (text: 'card' | 'ach')
├── intuit_card_id (text) -- reusable Intuit card/bank ref
├── brand (text) -- visa, mastercard, etc.
├── last4 (text)
├── exp_month (int)
├── exp_year (int)
├── is_default (boolean)
├── nickname (text)
└── created_at (timestamptz)
```

**Migration 036: SMS logging**
```
sms_log
├── id (uuid PK)
├── service_job_id (uuid FK → service_jobs)
├── customer_id (uuid FK → customers)
├── direction (text: 'outbound' | 'inbound')
├── message_type (text: 'on_my_way' | 'arrived' | 'departed' | 'custom')
├── body (text)
├── twilio_sid (text)
├── status (text: 'sent' | 'delivered' | 'failed')
├── sent_at (timestamptz)
└── created_at (timestamptz)
```

**Migration 037: Service checklists**
```
checklist_templates
├── id (uuid PK)
├── name (text)
├── job_type (text)
├── items (jsonb) -- [{label, required, type: 'check'|'text'|'photo'}]
├── organization_id (uuid FK)
├── active (boolean)
└── created_at (timestamptz)

service_job_checklists
├── id (uuid PK)
├── job_id (uuid FK → service_jobs, ON DELETE CASCADE)
├── template_id (uuid FK → checklist_templates)
├── items (jsonb) -- [{label, checked, notes, photo_url}]
├── completed_at (timestamptz)
├── completed_by (uuid FK → profiles)
└── created_at (timestamptz)
```

### NPM Dependencies to Add
```
@dnd-kit/core          # Drag-and-drop (React 19 compatible)
@dnd-kit/sortable      # Sortable lists for scheduler
@googlemaps/js-api-loader  # Client-side Google Maps
twilio                 # SMS messaging
```

### Environment Variables to Add
```
TWILIO_ACCOUNT_SID     # Twilio account
TWILIO_AUTH_TOKEN       # Twilio auth
TWILIO_PHONE_NUMBER     # Outbound SMS number
NEXT_PUBLIC_GOOGLE_MAPS_KEY  # Client-side maps
GOOGLE_MAPS_SERVER_KEY  # Server-side Routes API
```

---

## Phase 1A: Features That Can Be Built in Parallel (Months 1-4)

These three features have no dependencies on each other after Phase 0 is complete. They can be built simultaneously if resources allow, or sequentially in the recommended order.

---

### Feature 1: Purchase Order Management
**Priority:** Critical | **Effort:** ~3 weeks | **Why first:** Smallest scope, fully independent, fast competitive win

**Database migration (038):**
```
vendors
├── id (uuid PK)
├── name (text)
├── contact_name (text)
├── email, phone (text)
├── address, city, state, zip (text)
├── account_number (text)
├── payment_terms (text)
├── notes (text)
├── qbo_vendor_id (text)
├── active (boolean, default true)
└── created_at (timestamptz)

purchase_orders
├── id (uuid PK)
├── po_number (text UNIQUE) -- auto: PO-YYMMDD-XXXX
├── vendor_id (uuid FK → vendors)
├── location_id (uuid FK → locations) -- receiving location
├── status (text: draft|submitted|partial_received|received|cancelled)
├── line_items (jsonb) -- [{product_id, sku, name, qty_ordered, qty_received, unit_cost, total}]
├── subtotal, tax, total (numeric)
├── notes (text)
├── expected_delivery_date (date)
├── created_by (uuid FK → profiles)
├── approved_by (uuid FK → profiles)
├── qbo_po_id (text)
├── created_at, updated_at (timestamptz)

po_receipts
├── id (uuid PK)
├── purchase_order_id (uuid FK)
├── received_by (uuid FK → profiles)
├── received_at (timestamptz)
├── line_items (jsonb) -- [{po_line_index, qty_received}]
├── notes (text)
└── storage_location_id (uuid FK → locations)

ALTER TABLE inventory_units ADD:
├── purchase_order_id (uuid FK → purchase_orders)
└── vendor_id (uuid FK → vendors)
```

**New API routes:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/purchase-orders` | List/create POs |
| GET/PATCH | `/api/purchase-orders/[id]` | View/update PO |
| POST | `/api/purchase-orders/[id]/submit` | Mark submitted, email vendor |
| POST | `/api/purchase-orders/[id]/receive` | Record receipt, update inventory |
| GET/POST | `/api/vendors` | List/create vendors |
| GET/PATCH | `/api/vendors/[id]` | View/update vendor |

**New pages:**
| Route | Purpose |
|-------|---------|
| `/admin/purchase-orders` | PO list with status filters |
| `/admin/purchase-orders/new` | Create PO form |
| `/admin/purchase-orders/[id]` | PO detail with receipt tracking |
| `/admin/vendors` | Vendor directory |
| `/admin/vendors/new` | Add vendor |
| `/admin/vendors/[id]` | Vendor detail |

**Components:**
- `POForm` (client) — Create/edit PO with product line picker
- `POReceiveForm` (client) — Record partial/full receipt against PO
- `VendorSelect` (client) — Vendor dropdown with search
- `POStatusBadge` (server) — Status indicator

---

### Feature 2: Drag-and-Drop Service Scheduler
**Priority:** Critical | **Effort:** ~4 weeks | **Why second:** Unlocks Features 4 (mobile) and 5 (routing)

**Database migration (039):**
```
scheduler_settings
├── id (uuid PK)
├── organization_id (uuid FK)
├── default_view (text: 'day' | 'week')
├── business_hours_start (time, default '08:00')
├── business_hours_end (time, default '18:00')
├── slot_duration_minutes (int, default 60)
└── created_at (timestamptz)
```

**New/modified API routes:**
| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/api/service-jobs/[id]/reschedule` | Update date, time, tech, lane_order |
| GET | `/api/service-jobs/unassigned` | Jobs with no assigned tech |
| GET | `/api/service-jobs/by-range` | Jobs by date range + optional tech filter |

**New page:** `/service/scheduler` — Replaces basic calendar with interactive scheduler

**Components:**
- `SchedulerGrid` (client) — Main DnD grid with @dnd-kit/core
- `TechLane` (client) — Horizontal lane for one technician
- `TaskBlock` (client) — Draggable task card with color coding
- `UnassignedQueue` (client) — Sidebar droppable zone
- `DayView` / `WeekView` (client) — View switchers
- `SchedulerToolbar` (client) — Date nav, view toggle, filter controls

**Architecture decisions:**
- `@dnd-kit/core` + `@dnd-kit/sortable` (React 19 compatible, accessible, lightweight)
- Optimistic UI updates via React Query's `onMutate` → instant drag feedback, rollback on failure
- Supabase Realtime subscription on `service_jobs` table for multi-dispatcher sync
- Day view: hourly rows per tech lane. Week view: day columns per tech lane.

---

### Feature 3: Card on File & Mass Invoice/Pay
**Priority:** Critical | **Effort:** ~3 weeks | **Why:** High revenue impact for recurring service businesses

**Database migration (040):**
```
invoice_batches
├── id (uuid PK)
├── name (text) -- "April 2026 Recurring"
├── created_by (uuid FK → profiles)
├── status (text: draft|processing|completed|partial_failed)
├── total_amount (numeric)
├── invoice_count (int)
├── processed_count (int)
├── failed_count (int)
├── created_at, completed_at (timestamptz)

invoice_batch_items
├── id (uuid PK)
├── batch_id (uuid FK → invoice_batches)
├── service_invoice_id (uuid FK → service_invoices)
├── payment_method_id (uuid FK → customer_payment_methods)
├── status (text: pending|charged|failed)
├── charge_id (text) -- Intuit charge ref
├── error_message (text)
└── processed_at (timestamptz)

ALTER TABLE service_invoices ADD:
├── payment_method_id (uuid FK → customer_payment_methods)
└── batch_id (uuid FK → invoice_batches)
```

**New API routes:**
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/customers/[id]/payment-methods` | List stored methods |
| POST | `/api/customers/[id]/payment-methods` | Tokenize + store via Intuit Cards API |
| DELETE | `/api/customers/[id]/payment-methods/[pmId]` | Remove stored method |
| POST | `/api/service/invoices/batch-create` | Bulk create invoices for recurring orders |
| POST | `/api/service/invoices/batch-pay` | Charge stored methods for a batch |
| GET | `/api/service/invoices/batches/[id]` | Batch status and results |

**New pages:**
| Route | Purpose |
|-------|---------|
| `/admin/mass-invoice` | Batch invoice/payment management |

**Components:**
- `PaymentMethodsList` (client) — Show/manage stored cards/ACH on customer profile
- `AddPaymentMethodForm` (client) — Intuit card tokenization flow
- `BatchInvoiceWizard` (client) — Select recurring orders, preview, execute
- `BatchResultsTable` (client) — Show success/failure per invoice

**Architecture decisions:**
- Intuit Cards API (`/customers/{customerId}/cards`) creates reusable card references — NOT the single-use `createToken()` currently used
- Requires Intuit Customer entity — use existing `qbo_customer_id` from customers table
- Batch processing is sequential server-side (Intuit has no batch charge API) with per-item error isolation
- PCI scope: never store raw card data, only Intuit card reference IDs

---

## Phase 1B: Features That Depend on Phase 1A (Months 3-6)

---

### Feature 4: Field Service Mobile App (PWA)
**Priority:** Critical | **Effort:** ~6 weeks | **Depends on:** Scheduler (Feature 2) for job assignment data model
**This is the single largest competitive gap.**

**New pages (all under `/field/mobile/`):**
| Route | Purpose |
|-------|---------|
| `/field/mobile` | Layout with bottom nav, no sidebar |
| `/field/mobile/login` | PIN-based quick login |
| `/field/mobile/dashboard` | Today's task summary (completed/pending counts) |
| `/field/mobile/tasks` | Task list with status filters |
| `/field/mobile/tasks/[id]` | Full job detail with actions |
| `/field/mobile/route` | Map view with optimized route |
| `/field/mobile/profile` | Tech profile and settings |

**New API routes:**
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/pin-login` | Validate PIN, return session |
| POST | `/api/field/check-in` | Record GPS + timestamp on service_job |
| POST | `/api/field/check-out` | Record GPS + timestamp, compute duration |
| POST | `/api/field/sms` | Send SMS to customer via Twilio |
| POST | `/api/field/offline-sync` | Replay queued operations from IndexedDB |
| GET/POST | `/api/field/checklists` | Fetch template / save completed checklist |

**Components:**
- `MobileLayout` (client) — Phone-optimized shell with bottom nav
- `PinLoginForm` (client) — 4-6 digit PIN entry with lockout
- `TaskDashboard` (client) — Today's summary cards
- `TaskCard` (client) — Job card with status, customer, address, time
- `TaskDetail` (client) — Full job view with action buttons
- `CheckInOutControls` (client) — GPS-stamped start/stop with active timer
- `CustomerSMSButtons` (client) — On My Way / Arrived / Departed
- `WaterTestForm` (client) — Color-coded parameter entry
- `PhotoCapture` (client) — Camera + annotation overlay
- `ServiceChecklist` (client) — Configurable checklist per job type
- `SiteNotes` (client) — Gate code, pet info, access notes display
- `OfflineBanner` (client) — Network status indicator
- `MobileBottomNav` (client) — Dashboard, Tasks, Route, Profile tabs

**Architecture decisions:**
- PWA, not native — leverages existing Next.js stack, service worker, IndexedDB (`idb` already installed)
- PIN login = secondary unlock on authenticated device (long-lived refresh token in secure storage, PIN gates access)
- Separate `/field/mobile` layout — no AppShell sidebar, bottom nav only, phone-first viewport
- Offline strategy: `idb` queues mutations in IndexedDB; on reconnect, POST to `/api/field/offline-sync` replays in order
- Photos queued as blobs in IndexedDB offline, uploaded to Supabase Storage on reconnect

---

### Feature 5: Route Optimization
**Priority:** Critical | **Effort:** ~2 weeks | **Depends on:** Geocoded customers (Phase 0), Scheduler (Feature 2)

**Database migration (041):**
```
route_plans
├── id (uuid PK)
├── date (date)
├── tech_id (uuid FK → profiles)
├── job_ids (uuid[])
├── total_drive_minutes (int)
├── total_distance_miles (numeric 6,1)
├── waypoints (jsonb) -- Google Routes API response
├── optimized_at (timestamptz)
└── created_at (timestamptz)
```

**New API routes:**
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/routes/optimize` | Call Google Routes API, return optimized order |
| GET | `/api/routes/[techId]/[date]` | Fetch saved route plan |
| POST | `/api/customers/batch-geocode` | Geocode all customers missing lat/lng |

**New page:** `/service/routes` — Route planning view (also embedded in mobile app)

**Components:**
- `RouteMap` (client) — Google Maps with ordered stops and polylines
- `RouteStopList` (client) — Drag-to-reorder stop sequence
- `DriveTimeEstimate` (client) — Time/distance between stops

**Architecture decisions:**
- Google Routes API `computeRoutes` with `optimizeWaypointOrder: true` — handles TSP for up to 25 waypoints
- Geocode customer addresses on create/update, cache lat/lng on customer record
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` for client-side maps, `GOOGLE_MAPS_SERVER_KEY` for server-side Routes API
- Route view embedded in both scheduler sidebar and mobile app `/field/mobile/route`

---

## Phase 2: High-Priority Enhancements (Months 7-12)

These are scoped but NOT decomposed into atomic ISC yet. Each will get its own detailed spec when Phase 1 nears completion.

### 2A. Kit Bundles with Guided Questions (~3 weeks)
Product bundles (hot tub + cover lifter + steps + chemicals) with configurable "Kit Questions" (Question 1 of 3, 2 of 3) that guide sales reps through options. Requires new `product_bundles` and `bundle_questions` tables + modifications to Step3Products.

### 2B. Estimate Win/Loss/Expired Tracking (~2 weeks)
Formal outcome tracking on quotes with Win (promote to contract), Loss (with reason picklist), Expired statuses. "Outcome Update" modal on quote detail page. Reporting on win rate, loss reasons, conversion time.

### 2C. SMS/Text Messaging Platform (~3 weeks)
Expand Twilio integration beyond field service to cover:
- Appointment reminders (automated 24hr before)
- Payment confirmations
- Delivery notifications
- Two-way messaging from customer profile
- TCPA opt-in consent tracking per customer

### 2D. Custom Order Stages/Flags (~2 weeks)
Configurable status stages per document type beyond the fixed `draft → delivered` progression. Filterable from grid views. Admin UI to manage stage definitions.

### 2E. Customer Communication Preferences (~1 week)
Per-customer preferences: email only, text only, both, none. Respected across all automated outreach. Migration adds `comm_preference` to customers table.

### 2F. Site Profiles (~2 weeks)
Detailed site profiles linked to customer accounts: gate codes, water volume, spa dimensions, access notes, pet information, equipment history. Displayed on every service task in both web and mobile.

### 2G. Expanded Reporting Suite (~4 weeks)
- Best-selling SKUs by location and period
- Inventory valuation by location
- Aging AR report
- Non-purchasing customer list (last purchase > N days)
- Open opportunities funnel
- Service profitability by tech and job type

---

## Phase 3: Competitive Parity (Months 13-18)

### 3A. Retail POS Module
Cash-and-carry point of sale for walk-in chemicals/accessories. Returns processing, multiple tender types, cash drawer tracking.

### 3B. Vehicle Stock Sites
Service vehicles as inventory locations. Automated transfer-to-vehicle based on daily job assignments.

### 3C. Physical Count / Cycle Count
Inventory auditing workflows. Counting mode with variance reporting.

### 3D. Marketing Calendar & Workflow Tags
Internal marketing planning and tag-based workflow triggers on invoices/orders.

### 3E. Internal Task Management
Company-wide task assignment and tracking (opening checklists, supply ordering, van maintenance).

---

## Parallel Workstream: QBO Accounting Process Design

**This is NOT a competitive feature — it's an accounting compliance workstream that runs alongside Phase 1.**

Per Ian Allena's guidance (April 13, 2026):

1. **Schedule a working session** with Ian, Lori, Mike, and Willie to map the full accrual-based order-to-cash process
2. **Document the target workflow** covering: deposit recognition, revenue timing, refund handling, financing entries, tax liability
3. **Design the configuration switch** so Salta supports both Lori's current process (deposits → income) and the new process (deposits → liability → revenue at delivery)
4. **Get sign-off from Ian and Lori** before deploying any QBO automation changes
5. **Implement incrementally** — start with one location as a pilot

The QBO deposit-to-liability code already exists in `src/lib/qbo/client.ts` (`createQBODeposit`, `createQBOFinalInvoice`, `applyDepositsToInvoice`). It should NOT be deployed to production until the above process is complete.

---

## Build Order Summary

```
WEEK 1-2:  Phase 0 — Shared migrations (032-037) + npm deps + env vars
           ↓
WEEK 3-5:  Feature 1 (PO Management) — independent, fast win
WEEK 3-6:  Feature 2 (Scheduler) — independent, unlocks mobile + routing
WEEK 5-7:  Feature 3 (Card on File) — independent
           ↓
WEEK 7-12: Feature 4 (Field Mobile App) — depends on scheduler
WEEK 9-10: Feature 5 (Route Optimization) — depends on scheduler + geocoding
           ↓
MONTH 7+:  Phase 2 features (decompose as Phase 1 nears completion)
```

**Single-developer critical path:** 6 months for all Phase 1 features. With a second developer, Features 1-3 can parallelize to compress to ~4 months.

---

## Competitive Positioning (Immediate)

Even before Phase 1 is built, lead sales conversations with existing advantages:

1. **Modern, fast UI** — iPad-first PWA vs Lou's dated tile dashboard
2. **6-step guided contract builder** — Lou has a basic SKU form
3. **Real-time Avalara tax** — Lou has basic estimation
4. **Digital signatures** — Lou doesn't have this
5. **Trade show management** — Lou doesn't serve this vertical
6. **Delivery diagrams** — Unique to Salta

**Avoid competing on** service scheduling and field mobile until Phase 1 is complete.

---

## Success Metrics

| Metric | Baseline | Phase 1 Target |
|--------|----------|----------------|
| Feature parity vs Lou (critical gaps) | 5 gaps | 0 gaps |
| Service scheduling capability | Read-only calendar | Full DnD scheduler |
| Field tech mobile experience | Basic list view | Full PWA with offline |
| Recurring payment processing time | Manual per-invoice | Batch (minutes) |
| Route planning capability | None | Optimized with drive times |
| PO management | None | Full lifecycle |

---

*This plan is a living document. Phase 2 features will be fully specified when Phase 1 reaches 80% completion. The QBO accounting workstream timeline depends on scheduling the Ian/Lori/Mike working session.*
