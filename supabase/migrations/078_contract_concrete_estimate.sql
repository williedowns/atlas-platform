ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS concrete_estimate_pending BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concrete_estimate_notes TEXT;
