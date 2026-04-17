# Atlas Spas Accounting Workflow — Meeting Plan for Ian Allena

**Meeting date:** Week of April 20, 2026
**Attendees:** Ian Allena (CPA), Lori McGill (Bookkeeper), Mike Kimball, Willie Downs
**Duration recommended:** 2 hours minimum
**Prepared by:** Willie Downs
**Purpose:** Map Atlas Spas's order-to-cash workflow so we can safely launch the new Salta platform without disrupting Lori's process or creating accounting problems

---

## The Goal of This Meeting

We need to walk out of this room with three things decided:

1. **Phase 1 (this month):** How does Salta post transactions to QBO so Lori's workflow doesn't break?
2. **Phase 2 (60 days out):** What is the target accrual-based workflow, and how do we transition to it?
3. **Ownership:** Who does what going forward, especially with Mike potentially stepping back

Ian, we are not asking you to rubber-stamp what Willie built. We are asking you to help us design the real accounting backbone, and we'll build the software to match it.

---

## Why This Meeting Matters Now

Three things happened recently that force this conversation:

1. **Salta is ready.** Willie built a modern POS/contract system that's been working in testing. Atlas needs to go live on it — we are still doing paper contracts and handing Lori a stack of documents every week. That's not sustainable.

2. **Avalara is coming.** We just had our first Avalara meeting. They will automate sales tax calculation at point of sale AND file our returns. This is a huge win for Lori (no more manually looking up Louisiana parish rates), but it means Avalara becomes the authoritative source of sales tax data, not QBO.

3. **Mike is transitioning out.** Mike mentioned in the Avalara call he doesn't see himself being around much longer. Whoever replaces him — and Lori herself — needs a documented workflow, not tribal knowledge.

If we launch Salta without this meeting, here is what breaks:
- Salta's current code posts deposits to a liability account (`Customer Deposits`)
- Lori's current process books deposits to income accounts
- Result: Lori's Friday reconciliation doubles in complexity overnight
- Trust breaks, and Lori ends up hand-editing transactions the software is supposed to automate

**This meeting prevents that scenario.**

---

## Part 1: How Atlas Runs Today (Current State)

Before we design the new workflow, we have to agree on what the current one is. Ian, please correct anything below that's wrong.

### Sales Transaction (Today)
1. Customer visits a show or store
2. Salesperson fills out **paper** sales agreement
3. Salesperson collects deposit via **EVO payment terminal** (credit card)
4. Salesperson calculates sales tax **manually** — often wrong
5. Paper agreement + batch report faxed/emailed to home office next day
6. Lori receives paper, enters deposit into **QBO as income** to a location-specific sales account
7. Lori waits for delivery confirmation
8. When delivered, Lori treats the transaction as "completed" — no journal entry needed since revenue was already booked on cash basis
9. At month-end, Lori prepares location-by-location spreadsheets for sales tax filing
10. Mike files Texas returns using QBO data, files Louisiana returns using Spa Inc. reports

### Why This Breaks
- **Sales tax is often undercharged** — sometimes by hundreds or thousands of dollars per sale, absorbed as cost
- **Lori's month-end is chaos** — consolidating paper from shows, stores, brick-and-mortar into sales tax reports across 100+ reporting locations in Texas and 70-80 in Louisiana
- **Prescription exemption refunds are manual** — 30-day window, tracking is ad hoc
- **Cash basis income recognition** works but doesn't give clean picture of deposits held vs earned revenue
- **Louisiana destination-state rules** require reporting at signing, not delivery — current process doesn't cleanly handle this timing

---

## Part 2: How Atlas Will Run with Salta + Avalara + Intuit Payments (Future State)

### Sales Transaction (New)
1. Customer visits show or store, same as before
2. Salesperson enters customer + products into **Salta on iPad**
3. Salta calls **Avalara in real-time** → exact tax calculated by address (latitude/longitude accurate)
4. Customer signs digitally on iPad
5. Customer pays deposit via **Intuit Payments** (replacing EVO)
6. Salta posts to QBO — **the mechanism of this posting is what this meeting decides**
7. Avalara records the transaction as either estimate (deposit) or committed invoice (delivery)
8. At delivery, Salta marks contract delivered → QBO and Avalara updated
9. Month-end: Avalara auto-remits and files sales tax returns (Texas, Louisiana, etc.)
10. Lori has a dashboard in Salta showing all unreconciled items, prescription refund alerts, etc.

### Benefits
- **Sales tax is correct every time** — Avalara has latitude/longitude-accurate rates for every jurisdiction
- **Lori stops being the manual rate lookup service** — she becomes the auditor, not the calculator
- **Multi-location accounting becomes clean** — every transaction tagged by location/show automatically
- **Month-end is hours, not days** — Avalara files returns automatically
- **Prescription refunds are trackable** — Salta dashboard + automated credit workflow

### What Stays the Same
- QBO is still the general ledger (we are not replacing QuickBooks)
- Lori is still the bookkeeper, still reconciles, still reviews transactions
- Mike's/successor's role still exists — someone has to own the financial oversight
- All historical data stays where it is — we are not migrating the past, only changing the future

---

## Part 3: The Five Decisions We Need Ian's Input On

These are the specific questions that, once answered, let Willie write the code to match.

### Decision 1: Phase 1 Deposit Posting — Which Account Type?

**Option A (Recommended): Ship with Lori's current workflow**
- Salta posts deposits to **income accounts** (one per location, matching Lori's current chart)
- When delivered, no additional QBO entry needed
- Matches Lori's current mental model exactly
- Adds a **config flag** in Salta so we can switch to Option B later without code changes

**Option B: Ship with new liability workflow**
- Salta posts deposits to **liability sub-accounts** under "Customer Deposits" (already created in QBO)
- When delivered, Salta creates an invoice, applies the deposit as payment, recognizes revenue
- Correct accrual-based accounting
- Requires Lori to learn a new workflow at the same time she's learning a new software

**Our recommendation to Ian:** Option A for Phase 1. Ship the software, let Lori get comfortable with Salta, then tackle the accounting redesign as a separate project with you on Phase 2.

**What we need from Ian:** approve or redirect.

---

### Decision 2: Chart of Accounts Structure for Phase 1

If we go with Option A above, we still need to decide:
- **Per-location income accounts** (Sales - Tyler, Sales - Canton, Sales - Wills Point, etc.)?
- **Single consolidated income account** with QBO classes/departments for location tracking?
- **QBO items** (Deposit - Tyler, Deposit - Canton, etc.) that map to the income accounts?

**Note:** Willie has already created liability sub-accounts for the Phase 2 design (Customer Deposits - Tyler, - Canton, - Wills Point, - Shows). Those can stay and remain unused until Phase 2. Or we remove them if Ian prefers.

**Questions for Ian:**
- What income account structure do you currently use for each location?
- How do we handle sheds vs hot tubs in the chart? Different product categories → different income accounts?
- Should we add Oklahoma, Louisiana, Kansas, new territories as their own accounts or roll up under the existing Texas structure?

---

### Decision 3: Sales Tax Liability — Who Owns the Account in QBO?

With Avalara filing returns, QBO's Sales Tax Payable account becomes less central. But we still need a sales tax liability account for:
- Tracking tax collected between sale and remittance
- Reconciling Avalara's reports against QBO's books
- Auditing in case of state examination

**Questions for Ian:**
- Do we keep one Sales Tax Payable account or separate by state (TX, LA, OK, KS, NM)?
- Does Avalara post to QBO directly, or does Salta post and Avalara just files?
- How do we reconcile Avalara's reported tax collected against QBO's sales tax liability balance?

---

### Decision 4: Tax Exemption Refund Workflow (Chiropractor Prescription)

**Current process:**
- Customer buys hot tub, pays full tax
- Within 30 days, customer uploads chiropractor prescription
- Lori manually issues a refund for the tax amount in QBO
- Customer gets refund via credit card reversal

**New Salta process:**
- Customer uploads prescription in Salta customer portal
- Lori gets alert in Salta dashboard
- Lori clicks a button to approve → triggers:
  - Intuit Payments refund for tax portion
  - Avalara credit memo (retroactively classifies as exempt)
  - QBO credit memo / refund entry

**Questions for Ian:**
- Is this workflow acceptable from a control/audit standpoint?
- Who has authority to approve refunds (Lori? Mike? Requires dual approval?)
- How do we document the prescription as evidence of the exempt sale for state audit purposes?
- Does Avalara's exempt certificate storage meet the audit standard, or do we need to keep copies in QBO too?

---

### Decision 5: Louisiana Timing — Destination State Complication

Louisiana is a destination state. They want sales tax reported **at the time of signing**, not at delivery. This creates a timing problem:

- Accrual accounting says recognize revenue at delivery
- Louisiana says remit sales tax at signing

**Avalara handles the tax reporting timing automatically** (they know the rules). But what happens in QBO?

**Option A:** Revenue stays at delivery in QBO. Sales tax liability accrues at signing (Avalara handles). Books are clean on the accrual side, Avalara handles the state-specific timing.

**Option B:** Treat Louisiana sales differently — accelerate revenue recognition to signing. Creates inconsistency across states.

**Recommendation:** Option A. Let Avalara do what it's built for; keep QBO consistent.

**Question for Ian:** confirm Option A is acceptable from an accrual accounting standpoint.

---

## Part 4: The Phased Transition Plan

### Phase 1 — Ship Salta with Current Workflow (Weeks 1-4)

**Goal:** Atlas goes live on Salta for hot tubs without changing Lori's day-to-day process.

**Steps:**
1. This meeting → Ian approves Phase 1 design (income-account posting)
2. Willie implements QBO config flag (~1 day of code)
3. Willie runs end-to-end test: sale → deposit → Intuit → QBO → Lori verifies books
4. Pilot at one show (Tyler or Canton) — 10-20 contracts
5. Lori walks through first-week of Salta-generated QBO entries with Willie
6. Adjust based on what breaks
7. Roll out to all locations

**Success criteria:**
- Lori's month-end close takes same time or less than before
- No more than 2 manual corrections per week from Willie
- Sales tax matches Avalara's calculation 100% of the time

---

### Phase 2 — Design the Accrual Workflow (Weeks 5-8, parallel to Phase 1 rollout)

**Goal:** Design the target accrual-based workflow with Ian, document it, get Lori's buy-in.

**Steps:**
1. Schedule working session with Ian + Lori (2-3 hours)
2. Walk through every transaction type and map target QBO treatment
3. Document chart of accounts (liability accounts we already built + any adjustments)
4. Document revenue recognition rules per product type (hot tub vs shed)
5. Document refund, cancellation, exemption workflows
6. Draft a Lori training guide
7. Ian signs off on target-state design

**Deliverable:** A written Atlas Spas Accounting Operations Manual (10-15 pages) owned by Ian's firm.

---

### Phase 3 — Migrate to Accrual Workflow (Weeks 9-16)

**Goal:** Flip Salta's config flag from "income" to "liability" mode. Lori transitions to new reconciliation workflow.

**Steps:**
1. Pick a cutover date (e.g., start of a fiscal quarter for clean reporting)
2. Lori trained on new workflow (half-day session with Ian)
3. Willie flips the config flag in Salta
4. First week of cutover: Willie and Ian both monitor daily
5. First month of cutover: Willie on-call for adjustments
6. Quarter-end: Ian reviews books, confirms accrual treatment correct
7. Go fully live on accrual workflow

**Success criteria:**
- Balance sheet accurately reflects customer deposits as liability
- P&L accurately reflects revenue only when delivered
- No manual journal entries required from Lori in a typical month

---

## Part 5: Other Things to Cover in the Meeting

### Mike's Transition
Mike indicated in the Avalara call he doesn't see himself staying long. Questions:
- What is Mike's timeline?
- Who takes over Mike's responsibilities?
- Does Lori move into Mike's role and we hire a new bookkeeper underneath her?
- Does Ian's firm take on more of Mike's financial oversight role during transition?
- Property tax renditions — who owns this going forward?

### Property Tax & Business Licensing
Avalara offered property tax and business license services. Questions:
- Do we use Avalara for property tax? (They don't replace fixed asset tracking; they handle rendition filing)
- Do we use them for consumer credit license tracking across states?
- Or does Ian's firm continue handling this?
- Cost/benefit analysis — Willie to get Avalara pricing, Ian to compare

### Multi-State Expansion
Atlas is now in TX, LA, OK, KS, NM (or soon to be). Each state has different rules. Questions:
- Are we registered in each state for sales tax already?
- Do we have income tax nexus in any of these?
- Any specific compliance issues Ian sees with current expansion?

### Avalara Integration Specifics
- Avalara will send us API credentials — Willie needs these to finish the integration
- Avalara stores exemption certificates — do we still need to store them in QBO too?
- Avalara handles remittance and filing — Ian needs visibility into what they're filing on our behalf
- Can Ian review Avalara's returns before they're filed?

---

## Part 6: What to Walk Out of the Meeting With

### Decisions Documented
- [ ] Phase 1 deposit posting: Option A (income) or Option B (liability)
- [ ] Chart of accounts structure confirmed for Phase 1
- [ ] Sales tax liability account structure confirmed
- [ ] Prescription refund workflow approved
- [ ] Louisiana timing approach confirmed (Option A recommended)

### Next Steps Assigned
- [ ] Willie to implement config flag in Salta (1 day)
- [ ] Willie to schedule pilot at [location] on [date]
- [ ] Lori to document current month-end process in writing (1 week)
- [ ] Ian to review Phase 2 working session proposal
- [ ] Mike to clarify transition timeline
- [ ] Decision on Avalara property tax / business license add-on

### Future Meetings Scheduled
- [ ] Phase 2 working session with Ian + Lori + Willie (schedule for 4-6 weeks out)
- [ ] Quarterly accounting review cadence

---

## Appendix A: Avalara Meeting Summary (For Ian's Context)

Atlas met with Stephen and Becca at Avalara. Key points:
- Avalara AvaTax will automate sales tax calculation at POS across all jurisdictions
- Latitude/longitude-accurate rates (not zip-code based, which is important because rates change across city/county lines)
- Avalara will file sales tax returns automatically in every state we operate
- Product classifications matter — "hot tub recreational" vs "hot tub prescribed" can have different rates
- Louisiana parishes + Colorado home rule jurisdictions are the two hardest; Avalara handles both
- Prescription exemption: Avalara recommends charging tax by default, then crediting back when prescription is received (safer than assuming exemption upfront)
- Avalara can also handle property tax renditions and business license tracking (separate solutions)
- Avalara's API integration is what Salta connects to; Willie has the development kit

---

## Appendix B: Salta Platform Context (For Ian's Context)

Salta is the new POS/contract platform Willie built. Key capabilities relevant to accounting:
- Digital contracts signed on iPad (replacing paper)
- Real-time tax calculation via Avalara (replacing manual)
- Payment collection via Intuit Payments (replacing EVO)
- Customer portal for uploading prescriptions, viewing contracts
- Bookkeeper dashboard for Lori with reconciliation tasks
- QBO integration for posting transactions
- Multi-location tracking (each show, each store has its own reporting)
- Per-location chart of accounts mapping (already configured for the liability workflow)

The software is built and running in test mode. Ian's approval of the Phase 1 design is the last gate before Atlas goes live.

---

## Appendix C: What Willie Already Built in QBO (for Phase 2 readiness)

Per Ian's April 13 email guidance, Willie already set up these liability accounts in QBO for the future accrual workflow:

```
Customer Deposits (Other Current Liabilities)
  ├── Customer Deposits - Tyler
  ├── Customer Deposits - Canton
  ├── Customer Deposits - Wills Point
  └── Customer Deposits - Shows
```

And these QBO items mapped to those accounts:
- Deposit - Tyler
- Deposit - Canton
- Deposit - Wills Point
- Deposit - Shows

**For Phase 1 with Ian's approval:** these can be left in place unused, or Willie can re-map the items to point to income accounts temporarily (Ian's suggestion in his April 13 email).

Either approach works — just need Ian's preference.

---

*This plan is a working document. Ian is expected to modify, add to, or reject sections as needed. Willie will make revisions and resubmit if changes are significant. The goal is alignment, not adherence.*
