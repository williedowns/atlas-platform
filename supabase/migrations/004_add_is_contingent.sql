-- Add is_contingent flag to contracts
-- Contingent contracts are signed + deposit collected but conditional (e.g. "fits in yard")
-- They count toward gross revenue but are tracked separately from confirmed contracts.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS is_contingent boolean NOT NULL DEFAULT false;
