-- ── 098_contracts_tax_audit_columns.sql ───────────────────────────────────
-- Add audit-defense columns to contracts capturing HOW the tax rate was determined.
--
-- When a state auditor asks "why did you charge X% on this sale?", these
-- columns let us answer: which source (TX API / KS DOR / OK CSA / AR GIS /
-- a pinned venue / manual admin override / legacy default), when the rate
-- was in force at the source, and the exact jurisdiction breakdown.
--
-- All columns are NULLABLE. Existing contracts (pre-audit-log) retain NULL.
-- New contracts get these filled as each write surface is wired through.
--
-- Companion to migration 095 (tax lookup tables) and the lookup library
-- at src/lib/tax/lookupRate.ts.
-- -------------------------------------------------------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_rate_source text,
  ADD COLUMN IF NOT EXISTS tax_rate_effective_date date,
  ADD COLUMN IF NOT EXISTS tax_rate_jurisdictions jsonb,
  ADD COLUMN IF NOT EXISTS tax_rate_resolved_at timestamptz;

COMMENT ON COLUMN public.contracts.tax_rate_source IS
  'Origin of the tax_rate value applied to this contract. Examples: ''tx_comptroller_api'', ''ks_dor_lookup'', ''ok_csa_rate_locator'', ''ar_gis_lookup'', ''show_location:<uuid>'', ''manual_admin_override'', ''legacy_default''. NULL on pre-audit-log contracts.';
COMMENT ON COLUMN public.contracts.tax_rate_effective_date IS
  'The effective date the source said the rate was in force (per state DOR). NULL when source does not return effective dates (KS lookup, AR GIS, manual overrides).';
COMMENT ON COLUMN public.contracts.tax_rate_jurisdictions IS
  'JSONB array of {name, type, rate} objects breaking down state + county + city + transit + special districts. Captured at sale time so we can defend the rate decision later.';
COMMENT ON COLUMN public.contracts.tax_rate_resolved_at IS
  'Timestamp when our system resolved this rate (called the lookup and stored the answer). Distinct from contract created_at — the rate may have been pinned earlier from a venue cache.';

-- Index for audit queries: "show me all contracts whose rate came from <source>"
CREATE INDEX IF NOT EXISTS idx_contracts_tax_rate_source
  ON public.contracts (tax_rate_source);
