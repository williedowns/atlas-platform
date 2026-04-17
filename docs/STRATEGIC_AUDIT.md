 # Salta Platform — Strategic Product Audit

**Prepared for:** Willie Downs
**Date:** April 17, 2026 (Revised)
**Scope:** End-to-end audit of the Salta platform and its commercial trajectory — product, workflow, industry fit, UX, architecture, integrations, pricing, competitive position, launch readiness, and opportunities.
**Perspective:** Operator responsible for revenue — not a reviewer.

---

## Executive Summary — Read This First

**The verdict:** Salta is a working internal platform with a defined commercial destination, and the next 8 months determine whether it becomes a real business.

The strategic direction is now clear: the end-state is a **manufacturer-first pitch to Master Spas at the end of 2026**, selling a dealer platform + manufacturer dashboard for their 300+ global dealer network. Atlas Spas is the design partner. The dealer platform is built and working. The manufacturer dashboard doesn't exist yet.

**The three commercial realities:**

1. **You still have one customer (Atlas Spas).** Multi-tenancy exists in the database schema but has never been tested with a second organization. Master Spas will not buy from a one-customer company — you need 3-5 live dealer deployments by end of 2026 to have a credible pitch.

2. **The commercial engine is missing.** No pricing page, no self-serve trial, no customer-facing documentation, no case study. "Book a Demo" still routes to `hello@getsalta.com`. You cannot pitch Master Spas without this basic infrastructure in place, even if they're the only customer you care about in 2026.

3. **The math is smaller than first thought but still defensible.** A single Master Spas deal is worth $250-500k ARR (not $2M — prior memo was wrong). A direct-to-dealer motion yields $5-8k per dealer. Master Spas is still 30-60x more per contract than individual dealers, and adding 2-3 more manufacturers downstream gets to $1-2M ARR. This is a great small business, not a venture-scale opportunity.

**What's changed this week:**

- QBO config flag (`QBO_DEPOSIT_MODE=income|liability`) is built. Ready to flip once Ian approves Phase 1 workflow.
- Ian meeting scheduled for next week (Ian + Lori + Mike + Willie). Meeting plan document ready at `docs/IAN_MEETING_PLAN.md`.
- Avalara evaluation in progress. Solves sales tax across TX/LA/OK/KS/NM with automated filing.
- Mike signaled he's transitioning out in the Avalara meeting. Succession planning needed.
- Master Spas strategy committed to memory as the primary GTM path.

**What you should do, ranked:**

1. **Ship Atlas go-live the right way.** Execute the Ian/Lori/Mike meeting next week, get Phase 1 workflow approved, ship with config flag in income mode. Atlas running on Salta is the foundation of everything else.
2. **Close 3 paying dealer design partners by Q3 2026.** Target other Master Spas dealers specifically. The pitch: "We're building this with Atlas Spas; want to join the design partner program?"
3. **Incorporate Salta as a separate legal entity.** Before pitching Master Spas, spin Salta up as an LLC or C-Corp distinct from Atlas. Clean IP assignment protects you if Master Spas tries to argue Atlas owns the platform.
4. **Build the manufacturer dashboard MVP.** Real-time sales across dealer network, unit/model/color tracking, dealer rankings, market share view. This is the killer feature for the Master Spas pitch.
5. **Publish pricing and a real marketing site.** Even draft pricing unblocks sales conversations. A landing page with screenshots, a 60-second demo, and Atlas's case study moves you from "mystery software" to evaluable product.

The rest of this document backs up each claim with specifics and a prioritized action plan tied to the end-of-2026 pitch deadline.

---

## Part One — The Honest Truth About What Salta Is Today

Before auditing dimensions, establish reality.

### What exists and works

- 32 database migrations, 50+ pages, 60+ API routes
- Full contract lifecycle: draft → signature → payment → delivery → equipment registration
- Real integrations: QBO OAuth + SalesReceipt + Invoice + deposit application, Intuit Payments (card + ACH), Avalara AvaTax (estimate + commit), Resend email
- Customer portal with service requests, equipment tracking, contract viewing
- iPad-optimized UI with a 6-step guided contract builder (signature, delivery diagram, financing)
- Multi-location + multi-show financial mapping with per-location QBO item IDs (migration 032)
- QBO deposit workflow config flag (`QBO_DEPOSIT_MODE`) supporting both Lori's current workflow and the target accrual workflow
- Audit logging with IP + user agent on every significant action
- Role-based access: admin, manager, sales_rep, bookkeeper, field_crew, customer

### What exists in code but has never been used at scale

- Multi-tenancy (`organization_id` in 17+ files, one org seeded)
- Role-based permissions (works, never stress-tested by a second company)
- Mass email via Resend (sent invites only, not volume marketing)
- Service management tables (migration 031 — schema exists, UI light, no dispatcher flows)
- Offline queue table (exists but PWA offline sync not fully wired)

### What is marketed on getsalta.com but doesn't exist as a product

- "For hot tub dealers" (plural) — one live customer
- "Instant financing" — hardcoded providers (GreenSky, Wells Fargo, Foundation) specific to Atlas's deals
- "QuickBooks Sync" — works for Atlas's QBO connection; no self-service OAuth onboarding for a new dealer yet

### What does not exist at all

- Pricing page
- Free trial
- Marketing site with screenshots, video, case study, or testimonial
- Self-serve onboarding flow for a new dealer
- Written end-user documentation
- In-product help, tooltips, or first-run experience
- Any presence on G2, Capterra, Software Advice (where dealers actually compare software)
- Support ticketing or help desk for end customers
- Manufacturer dashboard (central to Master Spas pitch)
- Separate legal entity for Salta (IP protection requirement)

This is not failure — it is a choice based on scarce founder time. But every item above is a revenue blocker or pitch blocker by end of 2026.

---

## Dimension 1: Product & Functionality

**Verdict:** Excellent for the sales funnel Salta was built for. Thin for post-sale operations that dominate the revenue of most dealers.

### Core Feature Inventory

| Area | Completeness | Notes |
|------|-------------|-------|
| Contract builder (6-step) | 10/10 | Best-in-class. Better than Lou's estimate form. |
| Lead management | 6/10 | List and pipeline exist; no lead scoring, no automation, no SLA timers |
| Show/event management | 9/10 | Differentiator; Lou doesn't serve this vertical |
| Payment collection | 8/10 | Intuit card + ACH + manual. Missing: card-on-file, mass pay, partial payments |
| Inventory | 7/10 | Serials, transfers, locations. Missing: POs, cycle counts, vendor mgmt |
| Service requests | 5/10 | Customer can submit; triage exists. Missing: full service job lifecycle UX |
| Service jobs | 4/10 | Schema exists (migration 031), UI basic, no scheduler, no mobile tech app |
| Delivery | 7/10 | Work orders, diagrams, checklists. Missing: field crew mobile, route optimization |
| Analytics/reporting | 5/10 | Revenue, leaderboard, show breakdown. Missing: inventory valuation, aging AR, best-sellers |
| Accounting integration | 8/10 | QBO OAuth + SalesReceipt + Invoice + config flag. Awaiting Ian workflow sign-off |
| Customer portal | 8/10 | Contracts, equipment, service. Better than Lou's portal |

### Feature Gaps That Block Dealer Adoption

These are gaps where a prospective dealer would say "call me when this exists":

| Gap | Impact | Why it matters |
|-----|--------|---------------|
| Field tech mobile app | **High** | Service-heavy dealers get 30-40% of revenue from service |
| Drag-drop service scheduler | **High** | Dispatcher's daily tool; read-only calendar is not usable |
| Card on file + mass invoice/pay | **High** | Recurring service accounts need batch billing |
| Purchase order management | **High** | Any dealer with inventory needs this |
| Route optimization | **Medium** | Critical after 5+ techs |
| Retail POS | **Medium** | Required if dealer does cash-and-carry chemicals/accessories |
| SMS messaging | **Medium** | Customers increasingly expect text-based communication |
| Kit bundles with questions | **Medium** | Guided upsell at POS |

The Competitive Improvement Plan (`docs/COMPETITIVE_IMPROVEMENT_PLAN.md`) details implementation for each.

### Recommendations — Dimension 1

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Ship PO management (Phase 1 Feature 1) | High | 3 weeks |
| Ship drag-drop scheduler (Phase 1 Feature 2) | High | 4 weeks |
| Ship card-on-file + mass invoice (Phase 1 Feature 3) | High | 3 weeks |
| Ship field service mobile PWA (Phase 1 Feature 4) | High | 6 weeks |
| Merge quotes and contracts into one status-driven object | Medium | 2 weeks |

---

## Dimension 2: Real-World Workflow

**Verdict:** The show-floor sales workflow is exceptional. Post-sale workflows have critical gaps that will surface within 60 days of a second customer's first use.

### Lead → Showroom → Quote
- **Strong:** Show check-in, lead capture, quote drafting
- **Friction:** Walk-ins at stores don't have an obvious flow — captured as a lead via `/leads` while show reps use the contract builder directly. Two mental models for the same activity.

### Quote → Contract
- **Strong:** 6-step builder, real-time tax via Avalara, digital signature, delivery diagram
- **Friction:** If a rep saves and comes back tomorrow (common with financing decisions), the quote-to-contract transition isn't clearly surfaced. Zustand persists to localStorage but only on one device.

### Contract → Payment
- **Strong:** Multi-split deposits, card + ACH + cash, CC surcharge handled, Intuit integration works. Config flag now supports both Lori's income-mode workflow and the accrual liability workflow.
- **Friction:** No card-on-file for recurring service. No partial payment below the 30% default. Customer's tax exemption (chiropractor prescription) is handled manually by Lori.

### Payment → Delivery
- **Strong:** Status progression, delivery work orders, delivery diagrams
- **Friction:** No field crew mobile app. Today's delivery team would need to use the web app on their phone. Crew leads can't capture a delivery signature natively on their device.

### Delivery → Service
- **Strong:** Equipment auto-registers at delivery with warranty dates
- **Friction:** No warranty expiry outreach. No auto-scheduled annual water tests. No parts orders tied to warranty. No manufacturer warranty claim workflow.

### Service → Warranty Claim
- **Gap:** No warranty claim workflow at all. Atlas currently tracks these outside Salta. Master Spas would expect this in a platform they license to their network.

### Multi-location Blind Spots
- Inventory transfers work but no aggregate "where's the closest available unit" search
- Sales rep performance across all shows isn't clearly surfaced
- Per-location P&L dashboard doesn't exist in Salta itself (lives in QBO)

### Recommendations — Dimension 2

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Field mobile PWA | High | 6 weeks |
| Drag-drop scheduler | High | 4 weeks |
| Warranty expiry outreach automation | Medium | 2 weeks |
| Manufacturer warranty claim workflow | **High** (for Master Spas) | 3 weeks |
| "Closest available unit" inventory search | Medium | 1 week |
| Unify walk-in / show / quote-direct under one entity | Medium | 2 weeks |

---

## Dimension 3: Industry Fit & Problem Solving

**Verdict:** Solves the sales problem exceptionally. Under-solves the service, inventory, and accounting problems that actually define dealer economics.

### Top 5 Hot Tub Retailer Pain Points

1. **Sales process is paper-heavy and slow** — ✅ **Solved.** Salta's contract builder beats Method, Lou's form, and paper by a wide margin.
2. **Financing decisions under pressure create errors** — ✅ **Mostly solved.** Multiple providers, approval numbers, deduct-from-balance logic. Missing: live financing decision API integration.
3. **Service is the recurring revenue engine but feels like a cost center** — ❌ **Under-solved.** No field mobile, no scheduler, no route optimization, no mass billing.
4. **Inventory is always moving across locations/shows, units get lost** — 🟡 **Partially solved.** Serial tracking exists; POs, cycle counts, vehicle stock, reorder automation don't.
5. **Accounting is the bookkeeper's full-time Friday afternoon** — 🟡 **In progress.** Config flag shipped, Ian workflow session scheduled, Avalara evaluation active. Critical path clear.

### Underserved Pain Points

- **Warranty management** — dealers file warranty claims with manufacturers constantly; Salta has no workflow (and this is exactly what Master Spas would pay for)
- **Trade-in valuation** — common when selling a new spa; not handled
- **Delivery crew coordination** — crew rosters, truck assignments, appointment windows, customer-facing delivery tracking — missing
- **Customer re-engagement** — owners of 5-year-old spas need covers, chemicals, service; no re-engagement automation
- **Show ROI analysis** — Salta tracks show sales, but full cost vs revenue per show isn't calculated
- **Sales tax compliance across states** — current manual process is error-prone (see Avalara section below)

### The Avalara Conversation (new context)

The April 15 Avalara meeting surfaced critical context:

- **Current sales tax is frequently wrong** — Mike acknowledged the sales team often undercharges by hundreds or thousands per sale, absorbed as cost
- **Louisiana is a destination state** — requires reporting at signing, not delivery; current manual process struggles with 70+ parish jurisdictions
- **Texas alone has 100+ reporting locations**; adding OK, KS, NM compounds the problem
- **Prescription exemption refunds** are handled manually by Lori with 30-day windows — error-prone
- **Avalara solves this** with latitude/longitude-accurate rates, automatic filing, and exemption certificate storage

Avalara integration in Salta already exists (SalesOrder for estimates, SalesInvoice with `commit: true` at delivery). What remains: Atlas's Avalara contract, credential provisioning, product taxability mapping.

### Financing Complexity

Salta handles financing better than most:
- Multiple providers (GreenSky, Wells Fargo, Foundation)
- `deduct_from_balance` toggle correctly handles GreenSky/WF vs Foundation
- Approval number capture, provider-specific plans

Missing:
- **Real-time pre-approval APIs** (Synchrony, GreenSky APIs exist; Salta uses manual entry)
- **Soft-credit pre-qualification** at quote time
- **Post-close financing compliance** (TILA disclosures, Reg-Z archival)

### Recommendations — Dimension 3

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Complete Avalara integration (activate sandbox, map product taxability) | **Critical** | 2 weeks |
| Build warranty claim workflow (key for Master Spas pitch) | High | 3 weeks |
| Integrate GreenSky/Synchrony real-time approval API | Medium | 2 weeks |
| Customer re-engagement automation | Medium | 3 weeks |
| Show ROI calculator | Low | 1 week |

---

## Dimension 4: UX / UI / Flow

**Verdict:** Clean, modern, fast on iPad. Cognitive overload emerges at scale, and the landing page badly under-sells what exists inside.

### Navigation

- AppShell with fixed 224px sidebar on desktop/iPad — correct
- Role-based menus — correct
- 50+ page routes at one nav level — needs hierarchy as features grow

### Primary Workflows

- **Contract builder (6 steps):** Manageable — each step focused ✅
- **Dashboard:** Tries to do too much — stats + contracts + leads + overdue balances on one screen. Split needed ❌
- **Admin panel:** 16+ routes (users, permissions, locations, shows, inventory, work-orders, goals, commission, customers, service-requests, audit, settings). Groupings needed ❌

### Redundant / Confusing Screens

- `/contracts` and `/quotes` feel like duplicates
- `/admin/inventory` and `/inventory` — two views for different roles, needs shared components
- `/service`, `/service/jobs`, `/service/calendar`, `/service/invoices`, `/service/recurring` — needs tabbed hub, not five parallel pages

### iPad-First Claims

Verified in code: viewport fixed (no zoom), touch targets 44px+, sidebar collapses ✅
Not yet verified on device: keyboard-hiding-field behavior, sticky header, Apple Pencil signature capture

### Landing Page Critique (getsalta.com)

The weakest part of your commercial surface area:

- Four feature tiles with no screenshots — prospects want to see the product
- No pricing — first question every B2B evaluator asks
- No customer logo, testimonial, or case study — Atlas Spas is a customer; let them vouch
- No video — 60-second demo beats 60 feature bullets
- "Book a Demo" → email → Willie's inbox — not scalable, looks unprofessional
- No blog, content marketing, or SEO — dealers search "hot tub dealer software" and find Lou
- Missing OG image

### Recommendations — Dimension 4

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| 6-8 product screenshots + 60-second demo video on landing page | **High** | 1 week |
| Pricing page with 3 tiers (even "Contact Sales" for top) | **High** | 3 days |
| Replace mailto: demo CTA with Calendly or HubSpot form | **High** | 1 day |
| Atlas Spas case study (1 page, 1 real metric) | **High** | 1 week |
| Group admin routes under sub-nav | Medium | 1 week |
| Merge service sub-pages into tabbed hub | Medium | 1 week |
| Professional OG image | Low | 2 hours |

---

## Dimension 5: Technical Architecture

**Verdict:** Modern, well-chosen stack. Scalability risks sit at the multi-tenant boundary and the single-maintainer risk.

### Frontend

- Next.js 16 App Router + React 19 server components ✅
- Tailwind CSS 4, Radix UI primitives, Lucide icons ✅
- Zustand (contract draft), React Hook Form + Zod, React Query, `idb` (IndexedDB) ✅
- PWA with service worker versioning via postbuild script

**Risks:** Next.js 16 is aggressive; breaking changes are real (codebase has `AGENTS.md` noting this). Correct stack, aggressive version.

### Backend Data Flow

- API routes in `/app/api/` (60+)
- Supabase PostgreSQL + auth + storage
- RLS on every table
- Server components via cookie-authenticated client; admin ops via service-role client (bypasses RLS) — correct pattern

**Risks:** `SUPABASE_SERVICE_ROLE_KEY` is the nuclear key. Any leak = total data exposure. Audit which routes use it.

### Scalability

- **Database:** Fine to thousands of rows per table. `inventory_units`, `audit_logs`, `payments` will grow — needs planned indexes.
- **Multi-tenancy:** `organization_id` is the foundation but RLS policies must all filter on it. **Untested with two orgs. Biggest silent risk.**
- **Cold starts:** Vercel serverless functions cold-start — noticeable but fine for B2B.
- **QBO sync:** No caching layer; large charts of accounts will be slow on initial load.

### Technical Debt Signals

- Zamp → Avalara migration happened mid-session; residual references should be audited
- `createQBODepositInvoice` alias kept for backwards compat — acceptable but technical debt
- 32 migrations — clean but any naming/column drift from old migrations lives forever
- Service worker versioning via postbuild script — a failed script leaves stale cached app
- **Single-author codebase** is the biggest technical debt of all: truck factor of 1

### Fragility Points

- Intuit OAuth token refresh — if Willie steps away, expiry with no on-call = platform down
- QBO webhook coverage — changes made in QBO UI don't sync back to Salta; could drift
- Tax exemption workflow — manual cert upload/review is error-prone
- Signature upload — if Supabase Storage has an outage, signing fails silently

### Security Posture

- HTTPS enforced ✅
- Rate limiting on payment routes (15/min/IP) ✅
- Intuit tokenization (no raw card data) ✅
- Audit logging ✅
- Password reset without email enumeration ✅

**Gaps:**
- No 2FA for admin users
- No IP allow-listing for admin panel
- No anomaly detection
- No SOC 2

### Recommendations — Dimension 5

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Audit every RLS policy for `organization_id` filtering before second tenant | **Critical** | 1 week |
| Add 2FA for admin/manager roles | High | 1 week |
| Document QBO token refresh runbook | High | 2 days |
| Add DB indexes on frequently-queried columns | Medium | 2 days |
| Audit residual Zamp references | Medium | 1 day |
| **Hire second engineer (even contract) — truck factor 1 is the biggest risk** | **High** | Hiring |
| Pursue SOC 2 Type I before mid-market dealers or Master Spas enterprise | Medium | 6 months + $30-50k |

---

## Dimension 6: Integrations & Accounting

**Verdict:** Integration depth is real and expanding. The accounting workflow was the biggest operational landmine — now on a clear path to resolution.

### Status Summary

| Integration | Status | Notes |
|-------------|--------|-------|
| QBO OAuth + posting | ✅ Working | Config flag supports both income and liability workflows |
| Intuit Payments | ✅ Working | Card + ACH; card-on-file still to be built |
| Avalara AvaTax | ✅ Code complete | Atlas contract in progress; credentials pending |
| Resend email | ✅ Working | Invites, password reset, welcome |
| Google Maps / Routes | ❌ Not integrated | Needed for route optimization |
| Twilio SMS | ❌ Not integrated | Needed for field service + reminders |

### QBO Integration Depth

Fully built:
- OAuth flow with token refresh
- Customer sync, product sync, department sync
- **Deposit SalesReceipt posting with config flag (`QBO_DEPOSIT_MODE=income|liability`)**
- **Per-location and per-show deposit item mappings (migration 032)**
- Final Invoice at delivery
- Deposit application via Payment entity
- Account queries (chart of accounts)

### The Ian Conversation — State of Play

Per Ian Allena's April 13 email:
- Atlas's current workflow books deposits to income accounts
- The target accrual workflow books deposits to liability
- Code supports both; switching is a one-line env var change
- **Do not deploy the liability workflow without Ian/Lori/Mike sign-off**

**Meeting scheduled next week** with Ian, Lori, Mike, Willie. Meeting plan written at `docs/IAN_MEETING_PLAN.md`. Expected outcomes:
1. Ian approves Phase 1 workflow (income mode for safe go-live)
2. Ian/Lori walk through current process to document it
3. Schedule Phase 2 accrual design session
4. Clarify Mike's transition timeline

### Avalara — The New Context

The Avalara meeting (April 15) confirmed:
- Salta's existing Avalara code is correct (SalesOrder estimates + SalesInvoice commit at delivery)
- Avalara will handle TX/LA/OK/KS/NM filing automatically
- Louisiana's destination-state timing is handled by Avalara (no Salta-side change needed)
- Prescription exemption refund workflow: charge tax upfront, credit back when prescription arrives (Avalara credit memo + QBO credit)
- Avalara also offers property tax rendition and business license tracking as add-ons

**Recommendation for Ian meeting:** present Avalara property tax + licensing as an option Ian should evaluate vs. his firm's capacity.

### Intuit Payments

- Client-side tokenization (no raw card data server-side) ✅
- Card + ACH + refunds ✅
- **Missing:** card-on-file via Intuit Cards API (Phase 1 Feature 3 from CIP)

### Recommendations — Dimension 6

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Execute Ian/Lori/Mike meeting next week; decide Phase 1 vs Phase 2 workflow | **Critical** | 2 hours meeting |
| Complete Avalara contract + credential provisioning | High | 2 weeks |
| Document product taxability mapping for Avalara | High | 1 week |
| Build Intuit Cards API integration (card-on-file) | High | 2 weeks |
| Twilio SMS integration for customer communication | Medium | 2 weeks |
| Google Routes API for optimization | Medium | 2 weeks |

---

## Dimension 7: Business Model & Pricing

**Verdict:** No pricing published. Commercial model inferable but untested. **This must change before the Master Spas pitch — you cannot pitch a product without a price.**

### Current Reality

- getsalta.com has **zero pricing information**
- One customer (Atlas Spas), presumably not paying market rate
- No signed contract, no invoices, no MRR tracking visible

### Target Tier Proposal (corrected math)

Using Evosus Lou ($39-79/user/mo) as a benchmark and reworking numbers honestly:

| Tier | Price | Target | Includes |
|------|-------|--------|----------|
| **Salta Show** | $49/user/mo | Small dealers, show-heavy | Contracts, Avalara, portal, QBO, analytics |
| **Salta Pro** | $89/user/mo | Multi-location dealers | All Show + service jobs, scheduler, field mobile, POs |
| **Salta Enterprise** | $149/user/mo or custom | Regional chains, Master Spas | All Pro + SOC 2, SSO, manufacturer dashboard access, dedicated CSM |
| **Salta Mobile-Only** | $29/user/mo | Field techs | Mobile PWA access only |

**Setup fee:** $1,500 flat for standard onboarding ($5,000+ for Master Spas-level enterprise onboarding)

**Seasonal flexibility:** copy Lou's monthly-add/remove-license model. Proven winner in this vertical.

### The Master Spas Deal — Honest Math

A single Master Spas license deal is the primary commercial goal. Realistic sizes:

| Scenario | Per-dealer | 300 dealers | Dashboard fee | Total ARR |
|----------|-----------|-------------|---------------|-----------|
| Conservative | $50/mo | $180k | $75k | **$255k** |
| Mid | $75/mo | $270k | $100k | **$370k** |
| Premium | $100/mo | $360k | $150k | **$510k** |
| Stretch (500 dealers) | $75/mo | $450k | $150k | **$600k** |

**vs. Direct-to-Dealer Motion:**

| Path | Year 1 realistic | Year 2 | Year 3 |
|------|------------------|--------|--------|
| Direct to dealer (5/15/30 signed per year at $8k each) | $40k | $120k | $240k |
| Master Spas deal (closed end of 2026) | $0 closing year | $270-370k full year | $370-510k growing |

**Master Spas is still 3-5x better over three years** than direct. And if Master Spas works, landing Jacuzzi/Bullfrog/Hot Spring adds another $1-2M ARR.

This is a **great small business** — not a venture-scale SaaS. Plan financial life accordingly.

### Monetization Alternatives

1. **Per-dealer SaaS** (primary path) — recurring, scales with seats
2. **Per-transaction** (1-2% of contract value) — aligns incentives, easier first pitch
3. **White-label to manufacturer** (the Master Spas play) — single-contract leverage
4. **Marketplace take-rate** (financing, warranty, chemical reorder) — downstream purchases
5. **Internal tool for Atlas only** (valid choice if Master Spas declines)

### Recommendations — Dimension 7

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Publish pricing page with 3 tiers on getsalta.com | **Critical** | 1 day |
| Build a signed-contract template for first paying dealer | High | 1 week |
| Add Stripe/Intuit billing for Salta itself (eat your own cooking) | Medium | 2 weeks |
| Draft Master Spas deal structure document (Option A/B/C/D) | **High** | 3 days |
| Sketch 3-year revenue plan with honest numbers | **High** | 1 day |

---

## Dimension 8: Competitive Positioning

**Verdict:** Positioning clarity is the biggest messaging problem. "Modern sales platform for hot tub dealers" is a description, not a position.

### vs. Evosus Lou (primary competitor)

| Area | Salta | Lou |
|------|-------|-----|
| Sales workflow (contract builder, digital sign, Avalara) | **Ahead** | Basic |
| Trade show management | **Ahead** | Not available |
| Modern UI/UX | **Ahead** | Dated |
| Field service mobile | **Behind** | Mature |
| Scheduling (drag-drop) | **Behind** | Mature |
| POs, receive, vendor mgmt | **Behind** | Mature |
| Card-on-file, mass invoice | **Behind** | Mature |
| Accounting depth | **Parity via QBO** | Built-in (Enterprise) |
| Pricing | **Missing** | $39-79/user/mo |
| Market presence | **Zero** | Dominant |
| Manufacturer dashboard | **Planned** (strategic moat) | Not available |

### vs. Generic POS (Square, Shopify POS, Lightspeed)

- Generic beats Salta on: retail checkout speed, hardware ecosystem, payment reliability, pricing transparency
- Salta beats generic on: vertical-specific contracts, financing, delivery, QBO workflow, show management

### vs. Generic CRM (HubSpot, Pipedrive)

- Generic beats Salta on: lead nurturing, email automation, reporting, integrations ecosystem
- Salta beats generic on: industry workflows a generic CRM can never match

### Positioning Options

Pick ONE before Master Spas pitch:

1. **"The operating system for hot tub dealerships."** Strong, broad, defensible if manufacturer dashboard ships. **Recommended for Master Spas pitch.**
2. **"The modern alternative to Evosus Lou."** Directly attacks incumbent. Effective once Phase 1 feature parity ships.
3. **"The show-floor sales platform."** Narrow but very clear. Defensible niche.
4. **"iPad-first for hot tub dealers."** Device-first angle. Defensible.

### Recommendations — Dimension 8

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Pick ONE positioning statement, rewrite landing page | **High** | 3 days |
| Publish Salta vs Lou comparison page | High | 1 week |
| Get Atlas Spas listed as first review on G2/Capterra | High | 2 weeks |
| 5-slide pitch deck: "Why Salta over Lou" | High | 1 week |
| 10-slide pitch deck: "Why Master Spas should license Salta" | **Critical** | 2 weeks |

---

## Dimension 9: Launch Readiness

**Verdict:** Not ready for broad launch. Ready for Atlas internal go-live once Ian approves. Ready for a carefully-chosen second design-partner dealer in Q3 2026.

### Launch to Whom?

- **Not ready for self-serve:** no signup, no pricing, no docs, no in-product help
- **Not ready for mid-market (10+ user dealers):** multi-tenancy untested, no SSO, no SOC 2
- **Not ready for enterprise:** obvious
- **Ready for Atlas internal go-live:** pending Ian approval this week
- **Ready for design-partner dealer:** yes — if founder-led, white-glove, and paid upfront

### Critical Blockers (Ranked)

| Blocker | Status | Why It Blocks |
|---------|--------|---------------|
| Ian/Lori/Mike workflow sign-off | Meeting scheduled next week | Can't go live without accounting approval |
| Multi-tenancy RLS audit | Not done | Second customer could see Atlas's data or vice versa |
| No pricing published | Pending | Prospects can't evaluate |
| Single engineer (truck factor 1) | Ongoing | No on-call, no sick days |
| No manufacturer dashboard | Not started | Central to Master Spas pitch |
| No Salta legal entity | Not done | IP protection before Master Spas pitch |
| No case study | Not started | Prospects can't validate claims |
| No self-serve onboarding | Not started | Every new dealer = week of manual setup |
| No documentation | Not started | All support load falls on Willie |

### Minor Improvements (Don't Block but Matter)

- No status page (status.getsalta.com)
- No customer-facing uptime dashboard
- No support desk (Help Scout / Intercom)
- No marketing analytics on getsalta.com
- No OG image for social sharing
- No SEO work
- No product changelog / updates feed

### Multi-Tenancy Readiness — Specific Test

Before second customer, run this test:
1. Create org B with one user
2. Log in as org A user
3. Try to access org B's contracts via URL (`/contracts/[org-b-contract-id]`)
4. If it returns data → RLS policies are broken → Ship-stopper
5. Try same for payments, customers, inventory, service jobs
6. Run `SELECT * FROM contracts` as anon key from a different org context

### Recommendations — Dimension 9

| Recommendation | Impact | Effort |
|---------------|--------|--------|
| Execute Ian meeting; get Phase 1 workflow approved | **Critical** | Next week |
| Multi-tenancy RLS audit before design partner #2 | **Critical** | 1 week |
| Write pilot customer agreement template | High | 3 days |
| Build minimum self-serve signup (manual behind the scenes) | High | 2 weeks |
| Getting Started guide with 20 screenshots | High | 1 week |
| Incorporate Salta as separate LLC before Master Spas pitch | **Critical** | 2 weeks (lawyer time) |
| status.getsalta.com via BetterStack or Statuspage | Medium | 1 day |

---

## Dimension 10: Weak Points & Opportunities

### Top 5 Weaknesses (Ranked by Business Impact)

1. **No commercial engine.** Landing page, pricing, sales process, onboarding — missing or broken. **Cannot sell what you cannot price.**
2. **Truck factor of 1.** One engineer = one bus accident from platform death. Design partner dealers would discover this quickly.
3. **Post-sale feature depth.** Service mobile, scheduler, POs — where dealers make recurring revenue.
4. **Unverified multi-tenancy.** Schema suggests it works; untested is the silent risk.
5. **No separate legal entity for Salta.** Atlas currently owns the IP by default. Master Spas pitch risks — acquisition price floor undefined, IP ownership ambiguous.

### Quick Wins (< 2 weeks, High Impact)

| Quick Win | Why |
|-----------|-----|
| Pricing page with 3 tiers + "Contact Sales" | Unblocks inbound sales |
| Replace mailto: with Calendly | Converts better, feels professional |
| 10 product screenshots on landing page | Shows product, beats reading |
| Atlas Spas case study (1 page, 1 metric) | Social proof unlock |
| Multi-tenancy RLS audit | De-risks design partner onboarding |
| Complete Avalara credential setup post-contract | Unblocks live tax compliance |
| Incorporate Salta LLC | IP protection for Master Spas pitch |
| status.getsalta.com | Signals platform maturity |
| Professional OG image | Social shares look professional |

### Major Investments (2-6 months)

| Investment | Why |
|------------|-----|
| Field service mobile PWA | Biggest competitive gap |
| Drag-drop scheduler | Table stakes for service businesses |
| Card-on-file + mass invoice | Recurring revenue unlock |
| Purchase order management | Table stakes for inventory-heavy dealers |
| **Manufacturer dashboard MVP** | **Killer feature for Master Spas pitch** |
| SOC 2 Type I + documentation | Unlocks mid-market and Master Spas enterprise |
| Hire second engineer (contract OK) | De-risks everything |

### Strategic Opportunities

- **White-label for manufacturers (primary play).** Master Spas first, then Jacuzzi/Bullfrog/Hot Spring. Each worth $250-500k ARR.
- **Marketplace take-rate on financing.** GreenSky/Synchrony pay referral fees. Salta could capture a slice.
- **Industry consolidation.** Hot tub dealership industry is fragmented. Salta's data moat could position as acquisition target for PE roll-up.
- **Horizontal expansion.** Same pattern applies to RV dealers, motorsport, pool-only, high-end appliance. Risks losing vertical focus but proves scalable model.

---

## Part Two — The Three Execution Priorities for the Next 8 Months

The strategic direction is now set: **Master Spas pitch, end of 2026**. Everything flows from that.

These three priorities are the path to a successful pitch.

### Priority 1: Ship Atlas Live on Salta (Next 4-6 Weeks)

This is the foundation. Without Atlas actually running on Salta, there's no case study and no production validation.

**Steps:**
1. Ian/Lori/Mike meeting next week → Phase 1 workflow approved
2. Flip config flag to `QBO_DEPOSIT_MODE=income`
3. Configure QBO items per-location (income mode) in Admin UI
4. Run end-to-end test with dummy data
5. Pilot at Tyler show or store (10-20 contracts)
6. Monitor Lori's month-end with Willie + Ian on-call
7. Full Atlas rollout across all locations
8. Complete Avalara setup for live sales tax
9. Write Atlas Spas case study with real metrics

### Priority 2: Close 3 Paying Design-Partner Dealers (Months 2-7)

Without external customers, Master Spas will not take the pitch seriously.

**Targeting:** other Master Spas dealers specifically. Atlas's network is the first search space.

**Steps:**
1. Identify 10 Master Spas dealer prospects (ask Atlas's contacts)
2. Build design partner agreement template ($0-500/mo pilot pricing, 12-month commitment, feedback + case study in exchange)
3. Ship Phase 1 competitive gaps (PO, scheduler, card-on-file) before second customer
4. Multi-tenancy RLS audit before onboarding
5. Close first non-Atlas dealer (target: Q2 2026)
6. Close two more dealers (target: Q3 2026)
7. Document success metrics from each

### Priority 3: Build the Manufacturer Dashboard MVP (Months 4-7)

The killer feature for the Master Spas pitch. Without it, the pitch is incomplete.

**Scope:** demo-ready, not production-complete. The real version comes after Master Spas signs.

**Features needed:**
- Real-time sales view across all dealers
- Sales by model, color, spec
- Dealer leaderboard + ranking
- Active shows/events at any moment
- Market share view (Atlas + design partners as mocked "dealer network")
- Growth metrics + goal targets
- Inventory position across network

**Steps:**
1. Scope MVP features with Willie (1 week)
2. Build multi-tenant analytics aggregation (4 weeks)
3. Build visual dashboard UI (3 weeks)
4. Populate with real Atlas + design partner data (2 weeks)
5. Rehearse demo (1 week)

---

## Consolidated Action Plan — Next 90 Days

### Weeks 1-2 (Must-Do)
- [ ] Multi-tenancy RLS audit
- [ ] Ian/Lori/Mike meeting → Phase 1 workflow approved
- [ ] Configure QBO items per-location (income mode)
- [ ] Add pricing page to getsalta.com
- [ ] Replace mailto: with Calendly
- [ ] Take product screenshots, update landing page
- [ ] Complete Avalara contract + credentials

### Weeks 3-6
- [ ] Atlas go-live on Salta (pilot → full rollout)
- [ ] Begin Phase 0 migrations from Competitive Improvement Plan
- [ ] Write Getting Started documentation
- [ ] Identify 5 Master Spas dealer prospects
- [ ] Publish Atlas Spas case study
- [ ] Incorporate Salta LLC + clean IP assignment from Atlas
- [ ] status.getsalta.com live

### Weeks 7-12
- [ ] Ship Purchase Order management
- [ ] Ship Drag-Drop Scheduler
- [ ] Ship Card-on-File / Mass Pay
- [ ] Sign first paying design-partner customer
- [ ] Begin manufacturer dashboard MVP
- [ ] Close second design-partner customer

At day 90, reassess: is Atlas running cleanly? Do you have one real dealer customer? Is the manufacturer dashboard at 40% completion? If yes, stay the course. If no, evaluate.

---

## The Master Spas Pitch Timeline (End of 2026)

```
MONTHS 1-3 (now → July 2026)
  └─ Atlas go-live, 1 dealer closed, Phase 1 features shipping

MONTHS 4-5 (July-Sept 2026)
  └─ 2-3 dealers closed, manufacturer dashboard MVP underway

MONTHS 6-7 (Sept-Oct 2026)
  └─ Manufacturer dashboard demo-ready, pitch deck drafted
  └─ Master Spas exec contact identified and warmed

MONTH 8 (Nov 2026)
  └─ Legal entity finalized, IP clean, pricing locked
  └─ Pitch deck rehearsed, demo polished

MONTH 9 (Dec 2026 — Dealer Meeting)
  └─ Present Salta + manufacturer dashboard at Master Spas dealer meeting
  └─ Pilot proposal: Master Spas subsidizes 10 dealers at $Y/mo for 12 months
  └─ Go/no-go decision in Q1 2027
```

---

## Closing — One Operator's Take

Salta is not vaporware. It's a real working platform that runs a real business. That puts you ahead of 95% of "SaaS startups" in the vertical.

But a working platform is not a business. A business has a priced product, a repeatable sales motion, a second customer, documentation, a partner engineer, a legal entity, and a clear reason it exists besides "because we built it."

The next 8 months is the sprint to a single defining moment: the Master Spas dealer meeting at the end of 2026. Hit that pitch with Atlas running cleanly, 3 dealer customers referenced, a manufacturer dashboard demo, and clean IP — and you have a shot at $250-500k ARR from one contract.

Miss it, or walk in unprepared, and you spend 2027 pivoting to direct-dealer sales at $40k/year.

Ship the Ian meeting. Flip the config flag. Get Atlas live. Then go sign your second dealer.

---

*This audit represents one operator's analysis based on the publicly available getsalta.com, the Atlas Spas codebase (32 migrations, 50+ routes), the Evosus Lou competitive analysis, the Avalara and Ian Allena consultations, and the Master Spas strategic context committed to memory April 17, 2026. Numbers are directional. Decisions remain Willie's.*
