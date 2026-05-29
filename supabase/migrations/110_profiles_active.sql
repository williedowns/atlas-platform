-- profiles.active — soft enable/disable for team members.
-- Disabling blocks login and hides the user from the assignment picker while
-- preserving all of their contracts, commissions, and audit history. Reversible.
-- Hard-delete is intentionally NOT supported: contracts.sales_rep_id references
-- profiles(id) with no ON DELETE rule, so deleting a rep with deals is blocked
-- by the database anyway.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.active IS
  'When false the user is disabled: blocked at login and hidden from rep pickers. Data preserved.';

CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);
