# Atlas Spas Multi-State Sales Tax System

**Status:** Production code complete, runtime smoke test pending
**Last updated:** 2026-05-28
**Owner:** Willie Downs · Engineering touch points: see [Files](#files-and-locations)
**Outside dependency:** Ian Allena (CPA) for taxability sign-off + filing

---

## What this system does

When a sales rep writes a contract at a show, the system:

1. Resolves the show address to a **state-published sales tax rate** via that state's DOR (Department of Revenue) lookup.
2. Applies the rate + computes the tax on line items.
3. Persists the rate decision **with provenance** — source, effective date, jurisdiction breakdown — on the contract row.
4. Surfaces that provenance on the contract detail page so admins (and auditors) can see WHY a rate was charged.
5. Re-verifies pinned venues quarterly so rate drift gets caught.

**What it does NOT do:** file returns, manage exemption certificates (other than TX hydrotherapy / OK disabled-vet refunds), or transfer audit liability. Filing remains with Atlas's accounting firm; audit defense is software-supported (records + documentation) but the audit itself is human-led.

## States covered

| State | State rate | Lookup method | Notes |
|---|---|---|---|
| TX | 6.25% | Live REST API (TX Comptroller GIS) | Undocumented but free public API |
| KS | 6.5% | HTML form POST scrape (KDOR) | Separate food rate, captured for audit |
| OK | 4.5% | Django HTML scrape (OU CSA) | Aggressive rate limit — see below |
| AR | 6.5% | HTML form POST scrape (AR GIS) | Streamlined SST state |
| LA | 5% (state) | **Manual phone verification per parish** | Home-rule parishes; no usable state-wide lookup |

Local rates layer on top, capping at the state-specific maximum (TX 2% local cap; KS/OK/AR/LA have higher ceilings).

---

## Tax sourcing rule (cross-state sales)

Per the TX Comptroller's §151.330 guidance and the Avalara consultation 2026-05-28:

| Scenario | Sourcing basis | Tax applied |
|---|---|---|
| Customer takes possession at the trade-show floor | Show address | Show-state tax |
| Atlas delivers spa to customer's home (different state) | Customer ship-to address | Destination-state tax |
| Showroom walk-in (customer carries product home) | Showroom location address | Location-state tax |
| Showroom sale, Atlas delivers later | Customer ship-to address | Destination-state tax |

**The `/api/tax` endpoint accepts an optional `ship_to_address` body parameter that wins over `show_id` / `location_id` when supplied.** This is the system's hook for destination-rule sourcing. The wizard should pass it whenever the customer's delivery address is in a different state than the show/location.

The response includes a `sourcing_basis` field (`"ship_to"` | `"show"` | `"location"`) so the audit log can see which rule applied.

**Critical legal note** (per Avalara call): "If you were to get an audit for Louisiana or another state, sending that money back to Texas wouldn't fly." Atlas's contract should explicitly memorialize where possession transfers. "Delivery to customer's home in [state]" sources the sale to the destination state. "Customer picks up at show" sources to the show state.

## End-to-end chain

```
Wizard Step 3 (Products)
   ↓ POST /api/tax {show_id|location_id, line_items}
/api/tax  (src/app/api/tax/route.ts)
   ↓ Resolves ship-to address from show or location row
   ↓ Calls lookupRate({state, zip, street_address})
src/lib/tax/lookupRate.ts
   ↓ Tries (in order): venue cache → state-specific live lookup → legacy fallback
src/lib/tax/{txComptrollerApi, ksRevenueClient, okTaxClient, arGisClient}.ts
   ↓ Live state DOR response (JSON or scraped HTML)
/api/tax returns {tax_rate, tax_rate_source, tax_rate_jurisdictions, lookup_outcome}
   ↓ Step3Products captures audit fields
src/store/contractStore.ts
   ↓ setTax(amount, rate, audit) writes audit fields to ContractDraft
   ↓ User completes Step 5 (quote) or Step 7 (sign)
   ↓ ...draft spread → POST /api/contracts or /api/quotes
Server inserts row with tax_rate + 4 audit columns populated
   ↓ Admin views contract detail page
src/components/contracts/TaxRateProvenance.tsx
   ↓ Color-coded card shows source, breakdown, warnings
```

### Lookup outcomes

`lookupRate()` returns one of these `outcome` values:

| Outcome | Meaning | UI treatment |
|---|---|---|
| `show_location` | Hit on a pinned venue in `tax_show_locations` | Blue badge: "Pinned venue" |
| `tx_api` | Live TX Comptroller API success | Green badge: "TX Comptroller API" |
| `ks_api` | Live KS DOR webLookupResults.cfm success | Green badge: "KS DOR lookup" |
| `ok_api` | Live OK CSA Rate Locator success | Green badge: "OK rate locator" |
| `ar_api` | Live AR GIS Rate Locator success | Green badge: "AR GIS lookup" |
| `requires_verification` | LA address, OR lookup returned low-confidence | Amber: forces manual review |
| `by_zip` | Legacy `tax_rates_by_zip` view hit (deprecated) | Not normally used |
| `no_data` | No lookup path matched | Falls through to flat-rate default |

When `/api/tax` falls through to flat-rate (no high-confidence outcome), the contract row gets `tax_rate_source = "legacy_default"` (gray badge).

When an admin manually overrides via `/admin/contracts/[id]` → TaxSettingsEditor, the row gets `tax_rate_source = "manual_admin_override"` (amber badge with warning).

---

## Files and locations

### Library code

| Path | Role |
|---|---|
| `src/lib/tax/lookupRate.ts` | Top-level lookup orchestrator + types + `computeTax` helper |
| `src/lib/tax/txComptrollerApi.ts` | TX live REST client (free undocumented API) |
| `src/lib/tax/ksRevenueClient.ts` | KS form POST + HTML scrape |
| `src/lib/tax/okTaxClient.ts` | OK Django form + CSRF + HTML scrape + 503 retry |
| `src/lib/tax/arGisClient.ts` | AR form POST + HTML scrape |

### API routes

| Path | Purpose |
|---|---|
| `src/app/api/tax/route.ts` | POST — main tax-compute endpoint (lookup-first, falls back to flat) |
| `src/app/api/tax/lookup/route.ts` | POST — pure lookup endpoint (used by admin venue pin form) |
| `src/app/api/tax/venues/route.ts` | GET (list) + POST (pin) for `tax_show_locations` |
| `src/app/api/contracts/route.ts` | POST — persists audit fields with `legacy_default` fallback |
| `src/app/api/quotes/route.ts` | POST — same pattern as `/api/contracts` |
| `src/app/api/contracts/[id]/tax-settings/route.ts` | PATCH — admin rate override; writes `manual_admin_override` |
| `src/app/api/cron/tax-venue-reverify/route.ts` | GET — quarterly cron, sends digest email |

### Admin UI

| Path | Role |
|---|---|
| `src/app/admin/tax-venues/page.tsx` | Pin venue + list pinned venues |
| `src/components/admin/TaxVenuePinForm.tsx` | Lookup-and-pin form with LA-specific warning |
| `src/components/contracts/TaxRateProvenance.tsx` | Read-only provenance card on contract detail |
| Admin landing tile at `/admin` (in `src/app/admin/page.tsx`) | "Tax Venues" navigation |

### Schema

| Migration | Adds |
|---|---|
| `095_tax_rate_lookup.sql` | 4 tables: `tax_rates_raw`, `tax_rates_by_zip`, `tax_show_locations`, `tax_sku_taxability` + RLS |
| `096_tax_sku_taxability_seed.sql` | 44 taxability rows × 4 states |
| `097_tax_add_arkansas.sql` | Adds 'AR' to CHECK constraints + 11 AR taxability rows |
| `098_contracts_tax_audit_columns.sql` | Adds `tax_rate_source/_effective_date/_jurisdictions/_resolved_at` to `contracts` |

### Sync / utilities

| Path | Role |
|---|---|
| `scripts/sync_tax_rates.py` | Offline reference parser — pulls quarterly files from each state into `tax_rates_raw` for audit purposes |

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | Yes | Auths cron endpoints |
| `RESEND_API_KEY` | Yes | Email digest from re-verify cron |
| `INVITE_FROM_EMAIL` | Yes | "From" address on digest |
| `TAX_REVERIFY_DIGEST_RECIPIENTS` | **NEW for E.1** | Comma-separated recipients for quarterly digest. Example: `willie@hqatlas.com,ian@iancpa.com` |
| `TAX_LOOKUP_ENABLED` | Optional | Production kill switch. Set to `false` to force-disable the in-house lookup path and fall back to flat-rate. Use only if multiple state DOR endpoints fail simultaneously. Default `true`. |
| `TX_COMPTROLLER_CLIENT_ID` | Optional | Override TX API client_id (defaults to hardcoded public value) |
| `TX_COMPTROLLER_CLIENT_SECRET` | Optional | Override TX API client_secret (defaults to hardcoded public value) |
| `FLAT_TAX_RATE` | Optional | Fallback rate when lookup fails (default 0.0825) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Cron uses to bypass RLS |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase clients |

---

## State-by-state operational notes

### Texas (TX)

- **Endpoint:** `POST https://mulesoft.cpa.texas.gov:8088/api/cpa/gis/v1/salestaxrate/salestaxrate`
- **Auth:** Hardcoded `client_id` + `client_secret` (extracted from public web app)
- **Risk:** API is NOT in the documented portal at `api-doc.comptroller.texas.gov`. TX could rotate credentials or change the endpoint without notice. Mitigation: env-var override of the credentials.
- **Key rule for Atlas:** Texas Rule 3.291 — residential real-property service labor (e.g., crushed granite pad install) is NOT taxable. Atlas's historical 8.25% on the granite pad line is an over-collection. **Confirm with Ian before relying** (the row in `tax_sku_taxability` for `granite_pad_residential × TX` carries this flag with `ian_approved_at` still NULL).

### Kansas (KS)

- **Endpoint:** `POST https://www.kssst.kdor.ks.gov/webLookupResults.cfm`
- **Auth:** Session cookie from landing page GET + Referer header
- **Risk:** HTML scrape. KDOR could redesign the page without notice.
- **Quirk:** Returns a separate "food rate" column. Atlas doesn't sell food but we capture it for audit completeness.

### Oklahoma (OK)

- **Endpoint:** `POST https://taxproject.csa.ou.edu/Rate_Locator/address-results/` (Django)
- **Auth:** CSRF middleware token from landing page + session cookie + Referer
- **Risk:** **Aggressive nginx rate limit.** 7+ rapid requests trigger a 60-90s 503. The client has 503-retry-with-backoff. Bulk operations (quarterly cron) pace at 5s between requests; production single-lookups are well under the limit.
- **Edge case:** Form requires structured fields (house_number, street_direction, street_name, street_type). `parseOkStreetAddress` in `lookupRate.ts` is a heuristic — fails cleanly on malformed addresses (returns `no_data` rather than guessing).

### Arkansas (AR)

- **Endpoint:** `POST https://gis.arkansas.gov/Lookup/Results.php`
- **Auth:** None beyond Referer
- **Quirk:** Atlas is "very rarely" doing business in AR per Willie's note. Cache via pinned venues — most AR shows will be one-offs.
- **Streamlined SST state:** Taxability is largely uniform with TPP rules.

### Louisiana (LA)

- **No automated lookup.** Probed 2026-05-28: Parish E-File is ASP.NET WebForms with locked viewstate; salestaxexplorer.com is a paid commercial product. Neither is automatable without payment.
- **Home-rule parishes** administer local sales tax independently of the state. Rates change with short notice and aren't reflected in any state-wide file.
- **Process for any LA show / delivery:**
  1. Identify the destination parish for the address
  2. Call the parish Sales Tax Department at least 2 weeks before the show
  3. Confirm: state rate (5% as of 2025), parish rate, city rate, any tourism/convention/economic-development districts
  4. Combined LA rates typically run 8.45-11.45%
  5. INSERT a row into `tax_show_locations` via `/admin/tax-venues` with `verified_by` = "parish_phone_<name>_<date>" and `verification_notes` documenting who you spoke with
- **The quarterly cron flags LA venues as `manual_skip` in the digest** so admin knows to re-call the parish at each rate-change boundary.
- **Reference lookups** (sanity check only — do NOT rely as sole source):
  - https://parishe-file.revenue.louisiana.gov/lookup/
  - https://lulstb.com/
- The `lookupRate.ts` LA branch surfaces this entire instruction set as a `warning` string on the `requires_verification` outcome — admin sees actionable steps in the UI when LA fires.

---

## Admin workflows

### How to pin a verified venue

1. Navigate to `/admin/tax-venues`
2. Enter venue name + address + state + ZIP
3. Click "Look up rate" — system calls live state DOR lookup (or for LA, the form blocks and shows a yellow banner asking you to phone the parish first)
4. If outcome is high-confidence (green badge), click "Pin this venue"
5. Verify: row appears in the pinned venues list with date + verified_by populated

### How to handle a state DOR change

If a state changes their endpoint URL, response format, or credentials:

1. The quarterly cron digest will show failures (and you'll see them on individual contracts as "no provenance" or low-confidence outcomes)
2. Inspect the failing state's client file (e.g., `src/lib/tax/ksRevenueClient.ts`)
3. Re-probe the endpoint with curl using the patterns documented in the client's header comments
4. Patch the client surgically (URL, form fields, response parsing)
5. Add a unit test with the new response sample to `__tests__/` (TODO — E.3 not yet built)

### How to handle a contract over/under-collected

If audit reveals a contract had the wrong rate:

1. Pull contract detail page — read the `TaxRateProvenance` card
2. If source is `legacy_default` → expected for pre-wiring contracts. Atlas absorbs the difference per the Avalara call decision
3. If source is `manual_admin_override` → check who set it via `audit_log` (the existing `logAction` writes `contract.tax_settings_updated` with before/after values)
4. If source is a state API → grab the `tax_rate_jurisdictions` JSON and dispute with the state DOR if needed (their published data is the defense)

---

## Audit queries

```sql
-- Distribution of contracts by tax-rate source
SELECT tax_rate_source, count(*) AS n
FROM public.contracts
WHERE status IN ('signed','delivered','quote')
GROUP BY tax_rate_source
ORDER BY n DESC;

-- Find all contracts with manual admin overrides (rate not backed by state lookup)
SELECT id, contract_number, customer_id, tax_rate, tax_rate_resolved_at
FROM public.contracts
WHERE tax_rate_source = 'manual_admin_override'
ORDER BY tax_rate_resolved_at DESC;

-- Pinned venues by state with most-recent verification dates
SELECT state, count(*) AS venues, max(verified_at) AS most_recent_verify
FROM public.tax_show_locations
WHERE active = true
GROUP BY state
ORDER BY state;

-- SKU taxability rows still awaiting Ian sign-off
SELECT sku_category, state, is_taxable, notes
FROM public.tax_sku_taxability
WHERE ian_approved_at IS NULL
ORDER BY state, sku_category;
```

---

## Known limitations and roadmap

### Pending (in build plan but not yet shipped)

- **Smoke test in dev** — wiring is in code; no browser click-through has been done yet
- **E.2 — Proactive rate-change diff alert** — would download quarterly state rate files and diff against last quarter, alert before specific venues drift
- **E.3 — Parser unit tests** — frozen-sample tests on the state response parsers
- **TX RX / OK disabled-vet refund flow** — refund process exists but doesn't capture audit context yet

### Out of scope (by design)

- **Return filing automation** — Avalara would do this for $3,500/year. Atlas explicitly chose to keep filing with the accounting firm (decision 2026-05-28).
- **Exemption certificate management portal** — Atlas's prescription/RX workflow is in-app, not Avalara's cert portal (which is built for resale/nonprofit certs).
- **Audit defense (humans-in-the-loop)** — software produces records; CPA defends the audit. Avalara has the same limitation.

### Known fragility

- TX API and KS/OK/AR HTML scrapes are all built on undocumented endpoints. State agencies could redesign without notice. Mitigation: quarterly cron catches drift via the digest email; unit tests (when shipped) catch format breaks at CI time.
- OK CSA's rate limit means bulk operations need pacing. Anything > 5 requests in < 60s WILL trip a 503.
- LA stays manual. If the team adds many LA shows, this becomes a real operational burden.

---

## Decisions on record

| Date | Decision | Why |
|---|---|---|
| 2026-05-27 | Build in-house instead of Avalara | At the time, Avalara was estimated $7-15K/yr with high uncertainty |
| 2026-05-27 | Use live state APIs over file parsing | Discovered most states publish lookup APIs; eliminates file→jurisdiction mapping work |
| 2026-05-28 | Validated Avalara at $7.5K/yr; chose to STAY in-house | Operational cost (filing automation) traded against engineering ownership; flag late-LA-filing as the trigger for revisiting |
| 2026-05-28 | Added Arkansas (state #5) | Discovered during Avalara sales call that Atlas is registered in AR |
| 2026-05-28 | Cron observes mismatches, does NOT auto-update | Rate changes need human review — same separation Avalara uses |

---

## Quick test commands

Official smoke tests live in `scripts/tax-tests/`. Each script hits the live state endpoint, asserts the parser still finds expected fields, and exits non-zero on failure.

```bash
# Per-state (fastest: TX/KS/AR ~10s; slowest: OK ~7min with rate-limit pacing)
bun scripts/tax-tests/tx.ts
bun scripts/tax-tests/ks.ts
bun scripts/tax-tests/ar.ts
bun scripts/tax-tests/ok.ts

# All 4 in sequence (~10 minutes total)
bun scripts/tax-tests/smoke-all.ts

# Manually trigger the quarterly venue re-verify cron (replace $CRON_SECRET)
curl -H "Authorization: Bearer $CRON_SECRET" https://getsalta.com/api/cron/tax-venue-reverify
```

See `scripts/tax-tests/README.md` for what each test verifies and what to do when one fails.

---

## Contact / escalation

- Engineering questions → Willie
- Taxability calls (is this item taxable?) → Ian Allena
- Filing / remittance / audit → Ian + Atlas's accounting firm
- State DOR communication → Ian (CPA license is the front line)
