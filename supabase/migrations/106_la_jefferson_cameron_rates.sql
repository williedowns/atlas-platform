-- ── 106_la_jefferson_cameron_rates.sql ───────────────────────────────────
-- Phase LA.4 fix-up #4: backfill the 2 parishes that were missing from the
-- LATA workbook (Migration 102 left these intentionally blank).
--
-- Jefferson Parish — combined LOCAL rate 4.75% (parish-wide unincorporated
--   baseline, applies to Harvey/Marrero/Terrytown/Westwego/Lafitte and most
--   incorporated cities; Kenner Airport adds 2% → 6.75% local handled later).
--   Sources verified 2026-05-28:
--     - https://www.salestaxhandbook.com/louisiana/rates/jefferson-parish
--     - https://lataonline.org/for-taxpayers/city-to-parish-index/jefferson/
--     - https://www.avalara.com/taxrates/en/state-rates/louisiana/counties/jefferson-parish.html
--   All three agree: 9.75% combined (state 5% + parish 4.75%).
--
-- Cameron Parish — NO local parish sales tax. State 5% is the only rate.
--   combined_local_rate = 0.00000. Atlas treats this as the "Balance of
--   Parish" row so the la_lookup function's Strategy 4 catches it.
--   Sources verified 2026-05-28:
--     - https://www.salestaxhandbook.com/louisiana/rates/cameron-parish
--     - https://www.avalara.com/us/en/taxrates/state-rates/louisiana/counties/cameron-parish.html
--   Both agree: 5.00% (state only).
--
-- Surgical: just two `balance` rows so la_lookup_by_latlng resolves both
-- parishes via Strategy 4 (Balance of Parish catchall). City-level rows
-- can be added later if/when Atlas does business in a specific Jefferson
-- city with a non-baseline rate.
-- -------------------------------------------------------------------------

SELECT public.upsert_la_lata_jurisdiction(
  'Jefferson',                                            -- parish
  'Balance of Parish',                                    -- jurisdiction_name
  NULL,                                                   -- lata_column (n/a)
  'Parish Council: 1.75% | School Board: 1.50% | Sheriff: 0.25% | Hospital: 1.25%',
  0.04750,                                                -- combined_local
  0.05000,                                                -- state
  0.09750,                                                -- total
  'balance',                                              -- kind
  '2026-01-01'::date,                                     -- effective_date
  'https://www.salestaxhandbook.com/louisiana/rates/jefferson-parish',
  '2026-05-28'::date,                                     -- source_verified_at
  'Unincorporated Jefferson Parish baseline (Harvey/Marrero/Terrytown/West Unincorporated). Kenner Airport (+2%) and Harahan (+0.8%) need city-level rows if encountered. Backfilled 2026-05-28 because Migration 102 documented this parish as a known LATA gap.'
);

SELECT public.upsert_la_lata_jurisdiction(
  'Cameron',                                              -- parish
  'Balance of Parish',                                    -- jurisdiction_name
  NULL,                                                   -- lata_column
  'No parish sales tax — state only',
  0.00000,                                                -- combined_local
  0.05000,                                                -- state
  0.05000,                                                -- total
  'balance',                                              -- kind
  '2026-01-01'::date,
  'https://www.salestaxhandbook.com/louisiana/rates/cameron-parish',
  '2026-05-28'::date,
  'Cameron Parish has NO local sales tax — state 5% is the only rate. Backfilled 2026-05-28 because Migration 102 documented this parish as a known LATA gap.'
);
