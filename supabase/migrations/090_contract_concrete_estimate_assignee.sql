-- 088_contract_concrete_estimate_assignee.sql
-- Adds an assignee column for concrete pad estimates so they can be routed
-- to a specific profile. Routing rules (customer state → user) live in app
-- code: OK/KS → Ryan Frank, all other states → Alex Broyles (who can
-- reassign to Chip Stewart at his discretion).

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS concrete_estimate_assigned_to uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contracts.concrete_estimate_assigned_to IS
  'Profile assigned to perform the concrete pad site visit estimate. Auto-routed at contract submit based on customer state (OK/KS → Ryan Frank, others → Alex Broyles). Alex can reassign to Chip Stewart.';

CREATE INDEX IF NOT EXISTS idx_contracts_concrete_estimate_assigned_to
  ON public.contracts(concrete_estimate_assigned_to)
  WHERE concrete_estimate_assigned_to IS NOT NULL;
