-- Migration 064: Contract submission idempotency
-- Adds idempotency_key so retried submissions return the same contract
-- instead of duplicating rows. Required after 2026-05-01 incident where a
-- silent client-side state loss left the rep unable to recover the contract
-- ID; with this column, /api/contracts becomes safely retryable.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

-- Partial unique index: only enforce uniqueness when key is provided.
-- Existing rows (key NULL) are unaffected; new rows from the iPad flow
-- will always carry a key, and a duplicate POST with the same key from
-- the same rep will hit this index and be deduplicated server-side.
CREATE UNIQUE INDEX IF NOT EXISTS contracts_idempotency_key_idx
  ON public.contracts (sales_rep_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Lookup index for the find-recent endpoint (Step 8 auto-recovery).
-- Filters by sales_rep_id + recent created_at; customer match is via
-- the joined customers.email so we don't need an extra index here.
CREATE INDEX IF NOT EXISTS contracts_rep_recent_idx
  ON public.contracts (sales_rep_id, created_at DESC);
