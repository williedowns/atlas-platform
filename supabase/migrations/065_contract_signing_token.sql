-- Migration 065: Remote signing tokens
-- Lets a sales rep send a quote contract to the customer's phone for
-- signing + initials when the customer has left without finishing the
-- in-person flow. The token gates a public /sign/[token] page; signing
-- there flips the contract from `quote` to `signed`.
--
-- Three columns instead of a separate table because every contract has
-- at most one active signing link at a time, and we want the link state
-- visible alongside contract status without joins.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signing_token uuid;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signing_token_expires_at timestamptz;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signing_token_sent_at timestamptz;

-- Partial unique index: only enforce uniqueness when token is set.
-- After a successful sign or rotation, the column is cleared so the
-- old URL no longer resolves.
CREATE UNIQUE INDEX IF NOT EXISTS contracts_signing_token_idx
  ON public.contracts (signing_token)
  WHERE signing_token IS NOT NULL;
