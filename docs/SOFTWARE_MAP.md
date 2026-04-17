# Atlas Spas Platform — Complete Software Map

**Generated:** 2026-04-10
**Version:** 0.1.0
**Stack:** Next.js 16 (App Router) + React 19 + Supabase + Vercel

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema](#3-database-schema)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Page Routes](#5-page-routes)
6. [API Endpoints](#6-api-endpoints)
7. [Components](#7-components)
8. [State Management](#8-state-management)
9. [External Integrations](#9-external-integrations)
10. [Library Code](#10-library-code)
11. [Contract Lifecycle](#11-contract-lifecycle)
12. [Financial Architecture](#12-financial-architecture)
13. [File Structure](#13-file-structure)
14. [Environment Variables](#14-environment-variables)
15. [Deployment & Infrastructure](#15-deployment--infrastructure)

---

## 1. Architecture Overview

Atlas Spas Platform is a custom PWA replacing Method CRM + handwritten contracts for Atlas Spas, a multi-location hot tub dealership. It manages the full sales lifecycle from lead capture at trade shows through contract signing, payment collection, delivery, and post-sale service.

```
                    ┌──────────────────────────────────────────┐
                    │              Vercel (CDN + Edge)          │
                    │  Next.js 16 App Router (SSR + API Routes) │
                    └──────────────┬───────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────▼──────┐          ┌─────▼──────┐          ┌─────▼──────┐
    │  Supabase   │          │   Intuit    │          │  Avalara   │
    │  (Postgres  │          │  Payments   │          │  AvaTax    │
    │   + Auth    │          │  + QBO      │          │  Sales Tax │
    │   + Storage)│          │             │          │            │
    └────────────┘          └────────────┘          └────────────┘
          │
    ┌─────▼──────┐
    │   Resend    │
    │  (Email)    │
    └────────────┘
```

**Key Design Decisions:**
- Server Components by default (data fetched at the edge, zero client JS for read-only pages)
- Client Components only for interactivity (forms, modals, real-time updates)
- iPad-first touch interface (fixed viewport, no zoom, large tap targets)
- PWA with offline-capable service worker
- Role-based access control via Supabase RLS + middleware-level checks

---

## 2. Technology Stack

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.1 | App Router, SSR, API routes |
| React | 19.2.4 | UI rendering |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |

### Backend Services
| Service | Purpose |
|---------|---------|
| Supabase (PostgreSQL) | Database, auth, storage, RLS |
| Vercel | Hosting, edge functions, CDN |
| Intuit Payments | Credit card + ACH processing |
| QuickBooks Online | Accounting (invoices, deposits, customers) |
| Avalara AvaTax | Sales tax calculation + filing |
| Resend | Transactional email (invites, welcome, receipts) |

### Key Libraries
| Library | Purpose |
|---------|---------|
| `zustand` 5.x | Client state management (contract builder) |
| `react-hook-form` 7.x + `zod` 4.x | Form validation |
| `react-signature-canvas` | Digital signature capture |
| `jspdf` + `html2canvas` | PDF generation |
| `pdf-lib` | PDF manipulation |
| `@radix-ui/*` | Accessible UI primitives (dialog, select, tabs, etc.) |
| `@tanstack/react-query` | Server state caching |
| `date-fns` | Date formatting |
| `lucide-react` | Icon library |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Variant-based component styling |
| `idb` | IndexedDB for offline PWA support |

---

## 3. Database Schema

31 migrations define the database. All tables have RLS enabled.

### Core Tables

**`profiles`** — User accounts (extends Supabase auth.users)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References auth.users |
| email | text | Unique |
| full_name | text | |
| role | text | admin, manager, sales_rep, bookkeeper, field_crew, customer |
| assigned_location_id | uuid FK → locations | Optional |
| organization_id | uuid FK → organizations | Multi-tenant scoping |
| created_at | timestamptz | |

**`organizations`** — Multi-tenant org container
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| settings | jsonb | Branding, surcharge rates, etc. |
| role_permissions | jsonb | Feature flags per role |
| created_at | timestamptz | |

**`customers`** — End customers who buy hot tubs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| cascade_crm_id | text | Legacy CRM reference |
| qbo_customer_id | text | QuickBooks Online customer ID |
| first_name, last_name | text | |
| email, phone | text | |
| address, city, state, zip | text | |
| has_prescription | boolean | Medical prescription for tax exemption |
| prescription_url | text | Uploaded doc URL |
| created_at | timestamptz | |

**`locations`** — Physical store locations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Unique |
| type | text | 'store' or 'show' |
| address, city, state, zip | text | |
| phone | text | |
| cc_surcharge_enabled | boolean | Credit card surcharge toggle |
| cc_surcharge_rate | numeric | e.g., 0.035 = 3.5% |
| floor_price_enabled | boolean | Show floor pricing |
| qbo_deposit_account_id | text | Per-location QBO bank account |
| qbo_department_id | text | QBO Location/Department for P&L |
| active | boolean | |
| created_at | timestamptz | |

Seed data includes: Ennis, Tyler, Waco, Kansas (Wichita), OKC, Georgetown, Plano, Houston, Fort Worth showrooms.

**`shows`** — Trade shows / expos
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| location_id | uuid FK → locations | Parent location |
| venue_name | text | |
| address, city, state, zip | text | Venue address |
| start_date, end_date | date | |
| assigned_rep_ids | uuid[] | Sales reps working the show |
| qbo_deposit_account_id | text | Per-show QBO account |
| qbo_department_id | text | Per-show QBO department |
| active | boolean | |
| created_at | timestamptz | |

### Contract & Financial Tables

**`contracts`** — The core business entity
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contract_number | text | Unique, auto-generated |
| status | text | draft, pending_signature, signed, deposit_collected, in_production, ready_for_delivery, delivered, cancelled |
| customer_id | uuid FK → customers | |
| sales_rep_id | uuid FK → profiles | |
| show_id | uuid FK → shows | Nullable (store sale) |
| location_id | uuid FK → locations | |
| line_items | jsonb | Array of ContractLineItem |
| discounts | jsonb | Array of ContractDiscount |
| financing | jsonb | Array of ContractFinancing |
| subtotal | numeric | |
| discount_total | numeric | |
| tax_amount | numeric | From Avalara |
| tax_rate | numeric | |
| tax_exempt | boolean | TX exemption |
| tax_cert_url | text | Uploaded certificate |
| tax_cert_received | boolean | Cert verified by bookkeeper |
| tax_refund_amount | numeric | If refund issued |
| tax_refund_issued_at | timestamptz | |
| tax_refund_notes | text | |
| surcharge_amount | numeric | CC surcharge |
| surcharge_rate | numeric | |
| total | numeric | Grand total |
| deposit_amount | numeric | Required deposit |
| deposit_paid | numeric | Accumulated deposits |
| balance_due | numeric | Remaining balance |
| payment_method | text | |
| intuit_payment_id | text | Intuit charge ID |
| qbo_estimate_id | text | QBO Estimate ref |
| qbo_deposit_invoice_id | text | QBO SalesReceipt ref |
| qbo_final_invoice_id | text | QBO final Invoice ref (set at delivery) |
| customer_signature_url | text | Supabase Storage |
| printed_name | text | |
| signed_at | timestamptz | |
| contract_pdf_url | text | |
| delivery_diagram | jsonb | Delivery placement diagram |
| is_contingent | boolean | Contingent/conditional sale |
| notes | text | |
| created_at, updated_at | timestamptz | |

**`payments`** — Individual payment transactions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contract_id | uuid FK → contracts | |
| amount | numeric | |
| surcharge_amount | numeric | |
| method | text | credit_card, debit_card, ach, cash, financing |
| status | text | pending, processing, completed, failed, refunded |
| intuit_charge_id | text | Intuit Payments charge ref |
| card_brand | text | visa, mastercard, etc. |
| card_last4 | text | Last 4 digits |
| check_number | text | For manual checks |
| bank_name | text | For ACH |
| error | text | If failed |
| processed_at | timestamptz | |
| created_at | timestamptz | |

**`leads`** — Sales leads from shows and walk-ins
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| first_name, last_name | text | |
| email, phone | text | |
| show_id | uuid FK → shows | Nullable |
| location_id | uuid FK → locations | Nullable |
| assigned_to | uuid FK → profiles | |
| status | text | new, contacted, hot, converted, lost |
| source | text | show, walk_in, referral, web |
| notes | text | |
| converted_contract_id | uuid FK → contracts | If converted |
| created_at | timestamptz | |

### Product & Inventory Tables

**`products`** — Master product catalog (synced from QBO)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| qbo_item_id | text | QuickBooks item reference |
| name | text | |
| sku | text | |
| category | text | hot_tub, swim_spa, cold_tub, sauna, accessory, chemical, etc. |
| line | text | Clarity, H2X, Twilight Series, etc. |
| model_code | text | C Bal 7, X T19D, etc. |
| has_serial | boolean | Whether units need serial tracking |
| msrp | numeric | Manufacturer's suggested retail |
| floor_price | numeric | Minimum sale price |
| description | text | |
| photo_url | text | |
| min_stock_qty | integer | Reorder alert threshold |
| active | boolean | |
| synced_at | timestamptz | Last QBO sync |

**`inventory_units`** — Individual physical units with serial numbers
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| product_id | uuid FK → products | Nullable (legacy data) |
| location_id | uuid FK → locations | Current location |
| show_id | uuid FK → shows | If at a show |
| serial_number | text | |
| order_number | text | W-prefix factory order |
| status | text | on_order, in_factory, in_transit, at_location, at_show, allocated, delivered |
| unit_type | text | stock, factory_build, floor_model, blem, wet_model |
| shell_color | text | |
| cabinet_color | text | |
| wrap_status | text | WR (wrapped) or UN (unwrapped) |
| sub_location | text | |
| model_code | text | Raw model code from spreadsheet |
| delivery_team | text | atlas, fierce, houston_aaron |
| customer_name | text | Legacy: for units sold pre-system |
| fin_balance | text | Legacy: remaining finance balance |
| contract_id | uuid FK → contracts | If allocated/sold |
| delivery_work_order_id | uuid FK → delivery_work_orders | |
| msrp_override | numeric | |
| received_date | date | |
| notes | text | |
| created_at, updated_at | timestamptz | |

**`inventory_transfers`** — Transfer history between locations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| unit_id | uuid FK → inventory_units | |
| from_location_id, to_location_id | uuid FK → locations | |
| from_show_id, to_show_id | uuid FK → shows | |
| transferred_by | uuid FK → profiles | |
| notes | text | |
| created_at | timestamptz | |

### Service & Delivery Tables

**`equipment`** — Customer's registered equipment (auto-created at delivery)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| contract_id | uuid FK → contracts | |
| product_name | text | |
| serial_number | text | |
| purchase_date | date | |
| warranty_expiry | date | |
| created_at | timestamptz | |

**`service_requests`** — Customer-submitted service requests (portal)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| equipment_id | uuid FK → equipment | |
| description | text | |
| urgency | text | low, normal, high, emergency |
| status | text | new, acknowledged, scheduled, completed, cancelled |
| admin_notes | text | |
| created_at | timestamptz | |

**`service_jobs`** — Internal service work orders (migration 031)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| equipment_id | uuid FK → equipment | |
| assigned_tech_id | uuid FK → profiles | |
| service_request_id | uuid FK → service_requests | |
| type | text | maintenance, repair, installation, water_test |
| status | text | scheduled, in_progress, completed, cancelled |
| scheduled_date | date | |
| completed_at | timestamptz | |
| notes | text | |
| photos | jsonb | Array of photo URLs |
| water_test_results | jsonb | Chemical readings |
| created_at | timestamptz | |

**`service_job_water_tests`** — Water chemistry logs per service job
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| job_id | uuid FK → service_jobs | ON DELETE CASCADE |
| ph | numeric(4,2) | |
| alkalinity | int | ppm |
| sanitizer_ppm | numeric(6,2) | |
| temp_f | numeric(5,1) | |
| hardness | int | ppm calcium hardness |
| notes | text | |
| tested_by | uuid FK → profiles | |
| tested_at | timestamptz | |

**`service_job_photos`** — Photo documentation per service job
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| job_id | uuid FK → service_jobs | ON DELETE CASCADE |
| storage_url | text | Supabase Storage |
| caption | text | |
| uploaded_by | uuid FK → profiles | |
| created_at | timestamptz | |

**`service_invoices`** — Billing for service work
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| service_job_id | uuid FK → service_jobs | |
| customer_id | uuid FK → customers | |
| line_items | jsonb | Array of line items |
| subtotal | numeric(10,2) | |
| tax_amount | numeric(10,2) | |
| total | numeric(10,2) | |
| status | text | draft, sent, paid, void |
| qbo_invoice_id | text | |
| sent_at | timestamptz | |
| paid_at | timestamptz | |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |

**`recurring_service_templates`** — Recurring service job templates
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| customer_id | uuid FK → customers | |
| equipment_id | uuid FK → equipment | |
| job_type | text | maintenance, repair, warranty, install, follow_up, other |
| title | text | |
| description | text | |
| frequency | text | weekly, biweekly, monthly, seasonal |
| assigned_tech_id | uuid FK → profiles | |
| active | boolean | |
| next_generate_date | date | |
| last_generated_at | timestamptz | |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |

**`offline_queue`** — Queue for offline PWA operations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| device_id | text | |
| operation | text | |
| payload | jsonb | |
| status | text | pending, processing, completed, failed |
| error | text | |
| created_at | timestamptz | |
| processed_at | timestamptz | |

**`delivery_work_orders`** — Delivery scheduling and crew assignment
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contract_id | uuid FK → contracts | |
| assigned_crew_ids | uuid[] | |
| scheduled_date | date | |
| status | text | scheduled, in_progress, completed, cancelled |
| checklist | jsonb | Delivery checklist items |
| customer_signature_url | text | |
| completed_at | timestamptz | |
| notes | text | |
| created_at | timestamptz | |

### System Tables

**`audit_logs`** — Every significant user action
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| action | text | e.g., contract.created, payment.collected |
| entity_type | text | contract, payment, inventory_unit, customer, user |
| entity_id | uuid | |
| metadata | jsonb | Context-specific data |
| ip_address | text | |
| user_agent | text | |
| created_at | timestamptz | |

**`qbo_tokens`** — QuickBooks Online OAuth tokens (single-row, admin-only)
| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | Constrained to id=1 (single row) |
| realm_id | text | QBO company ID |
| access_token | text | OAuth access token |
| refresh_token | text | OAuth refresh token |
| expires_at | timestamptz | Token expiry |
| updated_at | timestamptz | |

### Database Functions
| Function | Purpose |
|----------|---------|
| `get_my_role()` | SECURITY DEFINER — returns authenticated user's role without recursive RLS |
| `get_my_org_id()` | SECURITY DEFINER — returns authenticated user's organization_id |
| `update_updated_at()` | Trigger function — sets updated_at on row modification |

**`sales_goals`** — Monthly sales targets per rep
**`commission_rates`** — Commission tiers per role

**`financing_providers`** — GreenSky, Wells Fargo, Foundation Finance
**`financing_plans`** — Specific plans per provider (plan number, dealer fee, term)

---

## 4. Authentication & Authorization

### Auth Flow
1. Employee login: Email + password via Supabase Auth
2. Customer portal: Email + password (separate flow, `customer` role)
3. Admin can generate passwordless login links (24hr expiry)
4. Admin can set passwords for new users
5. Branded invite emails via Resend (bypasses Supabase SMTP rate limits)

### Role Hierarchy
```
admin          → Full access to everything
manager        → All contracts, all leads, shows, inventory, service, analytics
sales_rep      → Own contracts, own leads, shows, contract creation
bookkeeper     → Contracts (view), financial reports, reconciliation
field_crew     → Delivery work orders, service jobs (assigned only)
customer       → Portal only: own contracts, service requests
```

### Permission System
- **RLS (Row-Level Security)**: Every table has Postgres policies enforcing role-based access
- **Org Permissions**: `organizations.role_permissions` JSONB field configures feature toggles per role
- **Default Permissions**: Defined in `src/lib/permissions.ts` as fallback
- **Features**: contracts, leads, shows, bookkeeper, inventory, analytics — each can be enabled/disabled per role

---

## 5. Page Routes

### Public Pages
| Route | Purpose |
|-------|---------|
| `/` | Landing page with hero, features, CTA |
| `/login` | Employee sign-in |
| `/auth/forgot-password` | Password reset request |
| `/auth/set-password` | Set new password from reset link |

### Customer Portal (`/portal`)
| Route | Purpose |
|-------|---------|
| `/portal` | Redirect to dashboard or login |
| `/portal/login` | Customer sign-in |
| `/portal/register` | Customer registration |
| `/portal/dashboard` | Customer home: contracts, equipment, service |
| `/portal/contract/[id]` | View contract details |
| `/portal/service-history` | Past service requests |
| `/portal/service-request` | Submit new service request |

### Internal Platform (Auth Required)
| Route | Purpose | Roles |
|-------|---------|-------|
| `/dashboard` | Main dashboard: stats, contracts, leads, overdue balances | admin, manager, sales_rep |
| `/profile` | User profile settings | All |
| `/contracts` | Contract list with filters | All except field_crew |
| `/contracts/new` | Multi-step contract builder | sales_rep+ |
| `/contracts/[id]` | Contract detail: customer, products, payments, QBO, equipment | All |
| `/contracts/[id]/collect-payment` | Payment collection form | sales_rep+ |
| `/contracts/[id]/delivery-diagram` | Spa placement diagram | All |
| `/leads` | Leads pipeline with status filters | sales_rep+ |
| `/leads/[id]` | Lead detail | sales_rep+ |
| `/shows` | Active shows list | sales_rep+ |
| `/shows/[id]` | Show detail: dates, team, leads | sales_rep+ |
| `/shows/[id]/checkin` | Show lead check-in (touch-optimized) | field_crew |
| `/quotes/[id]` | Quote detail (contract with status=quote) | sales_rep+ |
| `/analytics` | Revenue, leaderboard, shows, locations | admin, manager |
| `/bookkeeper` | Financial dashboard: CC reports, reconciliation, tax tracker | bookkeeper+ |
| `/financing` | Financing options (GreenSky, Wells Fargo, Foundation) | sales_rep+ |
| `/inventory` | Product inventory overview | sales_rep+ |
| `/field` | Field crew dashboard: deliveries + service jobs | field_crew, admin |
| `/field/service/[id]` | Field tech service job view (mobile) | field_crew |

### Service Management
| Route | Purpose | Roles |
|-------|---------|-------|
| `/service/jobs` | Service jobs list with status tabs | admin, manager |
| `/service/jobs/new` | Create service job | admin, manager |
| `/service/jobs/[id]` | Service job detail | admin, manager, assigned tech |
| `/service/calendar` | Calendar view of service jobs | admin, manager |
| `/service/invoices` | Service invoice list | admin, manager |
| `/service/recurring` | Recurring service contracts | admin, manager |

### Admin Panel
| Route | Purpose |
|-------|---------|
| `/admin` | Admin hub: QBO status, Avalara status, quick links |
| `/admin/users` | User management: invite, roles, passwords |
| `/admin/permissions` | RBAC configuration per role |
| `/admin/locations` | Store locations list |
| `/admin/locations/new` | Create location |
| `/admin/locations/[id]` | Edit location (QBO department, surcharge) |
| `/admin/shows` | Shows/events management |
| `/admin/shows/new` | Create show |
| `/admin/shows/[id]` | Edit show (QBO mapping) |
| `/admin/inventory` | Product inventory management |
| `/admin/inventory/new` | Add inventory item |
| `/admin/inventory/[id]` | Edit inventory item |
| `/admin/work-orders` | Delivery work orders |
| `/admin/work-orders/new` | Create work order |
| `/admin/work-orders/[id]` | Edit work order |
| `/admin/goals` | Sales goals per rep per month |
| `/admin/commission` | Commission rate configuration |
| `/admin/customers` | Customer directory with search |
| `/admin/service-requests` | Customer service request triage |
| `/admin/audit` | Audit log viewer with filters |
| `/admin/settings` | Org settings: branding, email |

**Total: 50+ page routes**

---

## 6. API Endpoints

### Authentication
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/request-reset` | Password reset (never leaks email existence) |
| GET | `/api/auth/callback` | OAuth callback handler |

### Contracts
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/contracts` | List/create contracts |
| PATCH | `/api/contracts/[id]/status` | Status transitions (triggers QBO invoice + Avalara at delivery) |
| PATCH | `/api/contracts/[id]/cancel` | Cancel contract (admin/manager) |
| PATCH | `/api/contracts/[id]/contingent` | Toggle contingent flag |
| PATCH | `/api/contracts/[id]/tax-exempt` | Mark tax exemption |
| PATCH | `/api/contracts/[id]/tax-refund` | Record tax refund |
| GET | `/api/contracts/[id]/pdf` | Generate contract PDF |
| GET | `/api/contracts/[id]/cert-url` | Signed URL for tax cert (private bucket) |
| POST | `/api/contracts/[id]/email` | Email contract to customer |
| POST | `/api/contracts/[id]/welcome-email` | Send welcome email |
| POST | `/api/contracts/[id]/mark-refunded` | Mark refund issued |

### Payments
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/payments/charge` | Credit/debit card charge (Intuit Payments, rate-limited 15/min/IP) |
| POST | `/api/payments/echeck` | ACH e-check |
| POST | `/api/payments/record-manual` | Cash/check manual recording |

### Leads
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/leads` | List/create leads |
| GET/PATCH | `/api/leads/[id]` | Get/update lead |

### Quotes
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/quotes` | List/create quotes |

### Service Jobs
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/service-jobs` | List/create |
| GET/PATCH | `/api/service-jobs/[id]` | Get/update |
| POST | `/api/service-jobs/[id]/complete` | Mark complete |
| POST | `/api/service-jobs/[id]/notify` | Send notification |
| POST | `/api/service-jobs/[id]/water-test` | Record water test |
| POST | `/api/service-jobs/[id]/photos` | Upload photos |
| GET | `/api/service-jobs/[id]/invoice` | Generate invoice |

### Service Recurring & Invoices
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/service/recurring` | List/create |
| GET/PATCH | `/api/service/recurring/[id]` | Get/update |
| POST | `/api/service/recurring/[id]/generate` | Generate job from template |
| GET/POST | `/api/service/invoices` | List/create |
| GET | `/api/service/invoices/[id]` | Get detail |
| POST | `/api/service/invoices/bulk-send` | Bulk email invoices |

### Inventory
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/inventory` | List/create |
| GET/PATCH | `/api/inventory/[id]` | Get/update |
| POST | `/api/inventory/[id]/transfer` | Transfer between locations |

### QuickBooks Online
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/qbo/connect` | Initiate OAuth flow |
| GET | `/api/qbo/callback` | Handle OAuth callback, store tokens |
| GET | `/api/qbo/accounts` | Fetch chart of accounts |
| GET | `/api/qbo/departments` | Fetch departments |
| POST | `/api/qbo/sync-products` | Sync product catalog |

### Tax (Avalara)
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/tax` | Calculate sales tax (SalesOrder estimate) |
| POST | `/api/avalara/ping` | Test Avalara connection |

### Admin
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/invite` | Create user invite |
| POST | `/api/admin/send-invite` | Send branded invite email (Resend) |
| POST | `/api/admin/set-password` | Set user password |
| POST | `/api/admin/generate-link` | Generate passwordless login link |
| PATCH | `/api/admin/users/[id]` | Update user role |
| GET/PATCH | `/api/admin/org-settings` | Org configuration |
| PATCH | `/api/admin/role-permissions` | RBAC config |
| PATCH | `/api/admin/locations/[id]` | Update location |
| PATCH | `/api/admin/products/[id]` | Update product |
| GET | `/api/admin/reorder-alerts` | Products below reorder threshold |
| PATCH | `/api/admin/service-requests/[id]` | Triage service request |

### Portal
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/portal/service-request` | Customer submits service request |
| POST | `/api/portal/upload-cert` | Customer uploads tax cert |

### Analytics
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/analytics/export` | Export data (CSV/JSON) |
| GET | `/api/bookkeeper/cc-report` | CC reconciliation report |
| GET | `/api/bookkeeper/cc-report/pdf` | Report as PDF download |

**Total: 60+ API endpoints**

---

## 7. Components

### UI Primitives (`src/components/ui/`)
| Component | Type | Purpose |
|-----------|------|---------|
| `Button` | Client | Variants: default, primary, outline, ghost, destructive, success. Sizes: sm, default, lg, xl, icon. Loading spinner. |
| `Card` | Server | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `Badge` | Server | Variants: default, secondary, success, warning, destructive, outline, accent |
| `Input` | Server | Input with optional label + error text |

### Layout (`src/components/layout/`)
| Component | Type | Purpose |
|-----------|------|---------|
| `AppShell` | Client | Sidebar nav (224px fixed), role-based menu items, user avatar, sign-out. Brand: #010F21 sidebar, #00929C active state |
| `BottomNav` | Client | Mobile bottom tab nav (role-aware) |

### Contract Workflow Steps (`src/components/contracts/Step*.tsx`)
All client components using Zustand `useContractStore`.

| Step | Component | What it does |
|------|-----------|-------------|
| 1 | `Step1Show` | Select show or store location |
| 2 | `Step2Customer` | Search existing or create new customer (react-hook-form + zod) |
| 3 | `Step3Products` | Product picker by product line, add line items, apply discounts, real-time Avalara tax calculation |
| 4a | `Step4Financing` | Select financing provider/plan, enter approval number, TX tax exemption toggle |
| 4b | `Step4Review` | Full contract summary, serial numbers, multi-deposit splits, save as quote or proceed to sign |
| 5 | `Step5Sign` | Signature pad (react-signature-canvas), printed name, legal disclosure, consent. Creates contract + uploads signature to Supabase Storage |
| 6 | `Step6Payment` | Payment collection: card, ACH, cash. Multi-split deposits |

### Contract Actions (`src/components/contracts/`)
| Component | Purpose | API Call |
|-----------|---------|----------|
| `ContractsList` | List/filter contracts by status, dates | Supabase query |
| `CancelContractButton` | Cancel with reason + optional refund | POST /api/contracts/[id]/cancel |
| `CertViewButton` | View tax exemption cert (signed URL) | GET /api/contracts/[id]/cert-url |
| `CollectPaymentForm` | Collect payment (card/ACH/cash) | Payment processor |
| `DeliveryConfirmDialog` | Financial summary + confirm delivery | PATCH /api/contracts/[id]/status |
| `ContingentToggle` | Toggle contingent flag | PATCH /api/contracts/[id]/contingent |
| `InventoryUnitPicker` | Pick specific inventory unit | Supabase: inventory_units |
| `PrintButton` | Trigger browser print | window.print() |
| `StatusTimeline` | Visual horizontal stepper for contract lifecycle | Pure render |
| `TaxRefundButton` | Issue tax refund for exempt contracts | POST /api/contracts/[id]/tax-refund |

### Admin Components (`src/components/admin/`)
| Component | Purpose |
|-----------|---------|
| `InviteUserButton` | Invite new team member with role |
| `GetLoginLinkButton` | Generate passwordless login link |
| `SetPasswordButton` | Set password for user |
| `UserRoleEditor` | Change user role |
| `PermissionsEditor` | Configure feature permissions per role |
| `OrgSettingsForm` | Edit org settings |
| `PingButton` | Test Avalara connection |
| `SyncProductsButton` | Trigger QBO product sync |

### Bookkeeper Components (`src/components/bookkeeper/`)
| Component | Purpose |
|-----------|---------|
| `CCReportView` | Credit card reconciliation (date range, search, PDF export) |
| `ReconciliationView` | Match bank transactions to payments |
| `SalesByEventList` | Sales breakdown by show/event |
| `CancellationRefundTracker` | Track cancelled contracts and refund status |
| `TaxExemptTracker` | Track tax-exempt contracts and cert status |

### Inventory Components (`src/components/inventory/`)
| Component | Purpose |
|-----------|---------|
| `InventorySearchTable` | Search/filter inventory units |
| `AddInventoryUnitForm` | Add new unit with serial, colors, status |
| `UnitDetailActions` | View/edit/delete unit |

### Dashboard (`src/components/dashboard/`)
| Component | Purpose |
|-----------|---------|
| `LeadsPipeline` | Visual lead funnel by status |

**Total: 41 components (34 client, 7 server)**

---

## 8. State Management

### Zustand Store: `useContractStore`
Located at `src/store/contractStore.ts`. Persisted to localStorage via `zustand/middleware/persist` (storage key: `atlas-contract-draft-v4`).

**State Shape (`ContractDraft`):**
```typescript
{
  // Context
  show_id?, show?, location_id?, location?,
  // Customer
  customer?,
  // Line items + discounts + financing
  line_items: ContractLineItem[],
  discounts: ContractDiscount[],
  financing: ContractFinancing[],
  // Payment
  deposit_splits: DepositSplit[],
  surcharge_enabled, surcharge_rate,
  // Tax (from Avalara)
  tax_amount, tax_rate, tax_exempt,
  // Computed totals
  subtotal, discount_total, surcharge_amount, total, deposit_amount,
  // Other
  notes?, delivery_diagram?,
}
```

**Key Actions:**
- `setShow()`, `setCustomer()` — Set context
- `addLineItem()`, `removeLineItem()`, `updateLineItemSerial()` — Products
- `addDiscount()`, `removeDiscount()` — Discounts
- `addFinancing()`, `removeFinancing()` — Financing
- `addDepositSplit()`, `removeDepositSplit()` — Multi-deposit splits
- `setTax()`, `setTaxExempt()` — Tax
- `setNotes()`, `setDeliveryDiagram()` — Metadata
- `recalculate()` — Recompute all totals
- `resetDraft()` — Clear for next contract
- `setCreatedContractId()` — After contract creation

---

## 9. External Integrations

### Supabase
- **Database**: PostgreSQL with 31 migrations, full RLS
- **Auth**: Email/password, admin user management, recovery links
- **Storage**: Private buckets for signatures, tax certificates, service photos
- **Client Libraries**:
  - `src/lib/supabase/client.ts` — Browser client (anon key)
  - `src/lib/supabase/server.ts` — Server component client (cookie-based auth)
  - `src/lib/supabase/admin.ts` — Service role client (bypasses RLS for admin ops)

### QuickBooks Online (`src/lib/qbo/client.ts`)
- **OAuth**: Connect flow via `/api/qbo/connect` → Intuit auth → `/api/qbo/callback`
- **Token Management**: Stored in `qbo_tokens` table, auto-refresh on expiry
- **Functions**:
  - `createQBODeposit()` — SalesReceipt to liability account (deposit collection)
  - `createQBOFinalInvoice()` — Full invoice at delivery (revenue recognition)
  - `applyDepositsToInvoice()` — Payment entity applying deposits to final invoice
  - `queryQBOAccounts()` — Fetch chart of accounts by type
  - `createQBODepositInvoice` — Backwards-compatible alias for `createQBODeposit`
- **Env Vars**: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_DEPOSIT_LIABILITY_ITEM_ID`, `QBO_DEFAULT_SALES_ITEM_ID`

### Intuit Payments (`src/lib/payments/intuit.ts`)
- **Authentication**: Uses same QBO OAuth token via `getQBOAccessToken()`
- **Card Tokenization**: `createToken(card)` — tokenizes card details, returns token string
- **Card Charges**: `createCharge(params)` — supports card_present_token (reader) or card_token (manual entry), returns ChargeResult with id, status (CAPTURED/AUTHORIZED/DECLINED), amount, card last4
- **ACH/eCheck**: `createECheck(params)` — routing/account number, returns status (PENDING/SUCCEEDED/DECLINED)
- **Refunds**: `refundCharge(chargeId, amount?)` — full or partial refunds
- **Helpers**: `calculateSurcharge()`, `totalWithSurcharge()`

### Avalara AvaTax (`src/lib/avalara/client.ts`)
- **Tax Calculation**: Real-time sales tax by jurisdiction (SalesOrder = estimate)
- **Tax Filing**: Committed transactions at delivery (SalesInvoice + commit)
- **Tax Code**: `P0000000` (Tangible Personal Property — hot tubs)
- **Functions**: `calculateTax()`, `commitTaxTransaction()`, `pingAvalara()`
- **Env Vars**: `AVALARA_ACCOUNT_ID`, `AVALARA_LICENSE_KEY`, `AVALARA_COMPANY_CODE`, `AVALARA_SANDBOX`

### Resend (Email) (`src/lib/email/`)
- **Templates**:
  - `invite-template.ts` — Branded invite email (name, role, login link)
  - `welcome-template.ts` — Post-signature welcome email
  - `reset-template.ts` — Password reset email
- **Brand**: #010F21 header, #00929C CTA button, Figtree font
- **Env Var**: `RESEND_API_KEY`

---

## 10. Library Code

### `src/lib/utils.ts`
- `cn()` — Tailwind class merge utility (`clsx` + `tailwind-merge`)
- `formatCurrency()` — USD currency formatting
- `formatDate()` — Date formatting via `date-fns`
- `generateContractNumber()` — Auto-generate contract numbers (format: `AS-YYMMDD-XXXX`)
- `calculateSurcharge()` — Applies percentage surcharge to amounts
- `calculateMinDeposit()` — Calculates minimum deposit (30% default)

### `src/lib/permissions.ts`
- `DEFAULT_PERMISSIONS` — Default feature flags per role
- `Feature` type — contracts, leads, shows, bookkeeper, inventory, analytics
- `RolePermissions` type — Mapping of role → feature → boolean

### `src/lib/audit.ts`
- `logAction()` — Fire-and-forget audit log insertion
- `AuditAction` type — 15 action types (contract.created, payment.collected, etc.)
- Captures IP address and user agent from request headers

### `src/lib/brand.ts`
- `PLATFORM_NAME` — SaaS product name (default: "Salta"), configurable via env
- `COMPANY_NAME` — Tenant name (default: "Atlas Spas"), configurable via env
- Brand colors: #010F21 (header), #00939B (buttons), #00929C (teal text/accents)
- Font: Figtree (400, 600, 700 weights)
- Logo: `/public/logo.svg`, white variant: `/public/salta-logo-white.svg`

### `src/lib/inventory-constants.ts`
- `isSpaProduct()` — Check if product category is a spa (hot_tub, swim_spa, cold_tub, sauna)
- Product line mappings, category groupings

---

## 11. Contract Lifecycle

```
                    ┌─────────┐
                    │  DRAFT  │ ← Contract created via Step1-6
                    └────┬────┘
                         │ Customer signs (signature pad)
                    ┌────▼────────────┐
                    │ PENDING_SIGNATURE│ ← Waiting for countersignature
                    └────┬────────────┘
                         │ Countersigned / auto-approved
                    ┌────▼────┐
                    │  SIGNED │ ← Contract fully executed
                    └────┬────┘
                         │ Payment collected (card/ACH/cash)
                    ┌────▼──────────────┐
                    │ DEPOSIT_COLLECTED  │ ← QBO SalesReceipt → liability
                    └────┬──────────────┘  ← Avalara SalesInvoice committed
                         │ Hot tub ordered / in factory
                    ┌────▼──────────┐
                    │ IN_PRODUCTION  │ ← Waiting for factory
                    └────┬──────────┘
                         │ Unit arrives, scheduled for delivery
                    ┌────▼──────────────────┐
                    │ READY_FOR_DELIVERY     │ ← Work order created
                    └────┬──────────────────┘
                         │ Delivery confirmed (DeliveryConfirmDialog)
                    ┌────▼────────┐
                    │  DELIVERED   │ ← QBO Final Invoice (revenue recognition)
                    └─────────────┘  ← Deposits applied as Payment
                                     ← Avalara SalesInvoice committed
                                     ← Equipment registered
                                     ← Balance due collected (if any)

    Any status → CANCELLED (admin/manager only, with refund tracking)
```

---

## 12. Financial Architecture

### Deposit Collection (Payment Time)
```
Customer pays $2,000 deposit
  → Intuit Payments charges card (or ACH/cash recorded)
  → QBO SalesReceipt created with "Customer Deposit" item
  → Posts to LIABILITY account (Customer Deposits - [Location])
  → contract.deposit_paid += $2,000
  → contract.balance_due recalculated
```

### Revenue Recognition (Delivery Time)
```
Contract marked "delivered"
  → QBO Invoice created with all line items at full price
  → Revenue recognized on location-specific income accounts
  → QBO Payment created applying accumulated deposits
  → Liability account debited (reduced), AR credited
  → Avalara SalesInvoice committed (tax filed)
  → Equipment auto-registered for customer
```

### Tax Handling
```
Contract creation: Avalara SalesOrder (estimate, non-committed)
Deposit collection: Tax amount stored on contract but NOT filed
Delivery: Avalara SalesInvoice + commit (tax filed for state remittance)
Tax exempt: TX exemption certificate uploaded, tax_exempt flag set
Tax refund: Tracked separately if tax was collected then exemption verified
```

### Financing
```
Three providers: GreenSky, Wells Fargo, Foundation Finance
GreenSky/Wells Fargo: deduct_from_balance = true (reduces balance at POS)
Foundation: deduct_from_balance = false (carries to balance, collected later)
Multiple financing entries per contract supported
```

---

## 13. File Structure

```
atlas-platform/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Figtree font, PWA meta)
│   │   ├── page.tsx                  # Landing page
│   │   ├── login/                    # Employee login
│   │   ├── auth/                     # Auth flows (forgot-password, set-password, callback)
│   │   ├── dashboard/                # Main dashboard
│   │   ├── profile/                  # User profile
│   │   ├── contracts/                # Contract CRUD + detail
│   │   │   ├── new/                  # Multi-step contract builder
│   │   │   └── [id]/                 # Detail, collect-payment, delivery-diagram
│   │   ├── leads/                    # Leads pipeline
│   │   ├── shows/                    # Shows + check-in
│   │   ├── quotes/                   # Quote detail
│   │   ├── analytics/                # Analytics dashboard
│   │   ├── bookkeeper/               # Financial dashboard
│   │   ├── financing/                # Financing options
│   │   ├── inventory/                # Inventory overview
│   │   ├── field/                    # Field crew dashboard + service
│   │   ├── service/                  # Service management (jobs, calendar, invoices, recurring)
│   │   ├── admin/                    # Admin panel (users, locations, shows, inventory, audit, etc.)
│   │   ├── portal/                   # Customer portal (login, dashboard, contracts, service)
│   │   └── api/                      # API routes
│   │       ├── auth/                 # Auth endpoints
│   │       ├── contracts/            # Contract CRUD + status + actions
│   │       ├── payments/             # charge, echeck, record-manual
│   │       ├── leads/                # Leads CRUD
│   │       ├── quotes/               # Quotes
│   │       ├── service-jobs/         # Service job CRUD + actions
│   │       ├── service/              # Recurring, invoices
│   │       ├── inventory/            # Inventory CRUD + transfers
│   │       ├── tax/                  # Avalara tax calculation
│   │       ├── avalara/              # Avalara health check
│   │       ├── qbo/                  # QBO OAuth + sync
│   │       ├── admin/                # Admin endpoints
│   │       ├── portal/               # Portal endpoints
│   │       ├── analytics/            # Export
│   │       └── bookkeeper/           # CC reports
│   ├── components/
│   │   ├── ui/                       # Primitives (Button, Card, Badge, Input)
│   │   ├── layout/                   # AppShell, BottomNav
│   │   ├── contracts/                # Step1-6, ContractsList, actions
│   │   ├── admin/                    # User management, settings
│   │   ├── bookkeeper/               # Financial reports
│   │   ├── inventory/                # Inventory management
│   │   └── dashboard/                # Dashboard widgets
│   ├── lib/
│   │   ├── supabase/                 # client.ts, server.ts, admin.ts
│   │   ├── qbo/                      # client.ts (QBO REST API)
│   │   ├── avalara/                  # client.ts (AvaTax API)
│   │   ├── payments/                 # intuit.ts (Intuit Payments)
│   │   ├── email/                    # invite, welcome, reset templates
│   │   ├── utils.ts                  # cn(), formatCurrency(), etc.
│   │   ├── permissions.ts            # RBAC defaults
│   │   ├── audit.ts                  # Audit logging
│   │   ├── brand.ts                  # Brand constants
│   │   └── inventory-constants.ts    # Product line mappings
│   ├── store/
│   │   └── contractStore.ts          # Zustand store for contract builder
│   └── types/
│       └── index.ts                  # All TypeScript interfaces
├── supabase/
│   └── migrations/                   # 001-031 SQL migrations
├── public/
│   ├── logo.svg                      # Atlas Spas logo
│   ├── salta-logo-white.svg          # White sidebar logo
│   ├── manifest.json                 # PWA manifest
│   └── sw.js                         # Service worker
├── docs/
│   ├── qbo-accounting-setup.md       # QBO configuration guide
│   └── security-backup-operations.md # Security & backup guide
├── scripts/
│   └── update-sw-version.js          # Post-build SW version bump
└── package.json
```

---

## 14. Environment Variables

### Required for Production
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only, bypasses RLS) |
| `QBO_CLIENT_ID` | QuickBooks OAuth client ID |
| `QBO_CLIENT_SECRET` | QuickBooks OAuth client secret |
| `INTUIT_MERCHANT_TOKEN` | Intuit Payments merchant token |
| `AVALARA_ACCOUNT_ID` | Avalara AvaTax account |
| `AVALARA_LICENSE_KEY` | Avalara license key |
| `RESEND_API_KEY` | Resend email API key |

### QBO Configuration
| Variable | Purpose |
|----------|---------|
| `QBO_DEPOSIT_LIABILITY_ITEM_ID` | QBO Item mapped to liability account (new, correct) |
| `QBO_DEPOSIT_ITEM_ID` | Legacy QBO Item (fallback) |
| `QBO_DEFAULT_SALES_ITEM_ID` | Fallback for products without QBO mapping |
| `QBO_CUSTOMER_DEPOSITS_ACCOUNT_ID` | Default bank account for deposits |

### Optional
| Variable | Purpose |
|----------|---------|
| `AVALARA_COMPANY_CODE` | Avalara company code |
| `AVALARA_SANDBOX` | "true" for sandbox testing |
| `QBO_SANDBOX` | "true" for QBO sandbox |
| `SHIP_FROM_ADDRESS/CITY/STATE/ZIP` | Tax origin address |
| `NEXT_PUBLIC_SITE_URL` | Public site URL for emails |

---

## 15. Deployment & Infrastructure

### Hosting
- **Vercel**: Automatic deployments from git
- **Edge Network**: SSR at the edge, API routes as serverless functions
- **Preview Deployments**: Each PR gets a preview URL

### PWA
- `manifest.json` with Atlas Spas branding
- Service worker (`sw.js`) with version-based cache busting
- `postbuild` script updates SW version on each deploy
- Fixed viewport (no zoom) for iPad POS usage

### Database
- **Supabase Pro Plan**: Daily backups, PITR
- **31 migrations**: Schema versioned and repeatable
- **RLS on all tables**: Security at the database level

### Security
- HTTPS enforced (Vercel TLS 1.3)
- Supabase Auth with JWT
- Rate limiting on payment endpoints (15/min/IP)
- Card tokenization via Intuit (PCI compliant — numbers never touch server)
- Service role key server-only (never exposed client-side)
- Audit logging on all significant actions
