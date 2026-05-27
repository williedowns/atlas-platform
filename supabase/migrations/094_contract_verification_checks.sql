-- ── 094_contract_verification_checks.sql ─────────────────────────────────
-- Per-contract verification rows used by the Show Manager Verification
-- Dashboard. Each row captures one named check (e.g. customer_signed,
-- financing_portal_approved, intuit_charge_settled) and its human-verified
-- status. Auto-derived checks (signature on file, deposit math) are computed
-- on the read path; this table stores the human-confirmed truth and any
-- discrepancy notes.
--
-- Daily checklist (during show) and post-show checklist read from the same
-- rows — they're just filtered/aggregated views.
--
-- One row per (contract_id, check_key). Lazily created on first GET of the
-- verification API.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_verification_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  check_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','discrepancy','na')),
  notes text,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_cvc_contract ON public.contract_verification_checks (contract_id);
CREATE INDEX IF NOT EXISTS idx_cvc_status   ON public.contract_verification_checks (status);

-- Auto-bump updated_at on every change
CREATE OR REPLACE FUNCTION public.touch_contract_verification_checks()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_cvc ON public.contract_verification_checks;
CREATE TRIGGER trg_touch_cvc
  BEFORE UPDATE ON public.contract_verification_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_contract_verification_checks();

-- RLS — back-office function. Restricted to admin/manager/bookkeeper.
-- Sales reps cannot read or write verification checks.
ALTER TABLE public.contract_verification_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cvc_read" ON public.contract_verification_checks;
CREATE POLICY "cvc_read" ON public.contract_verification_checks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.profiles me ON me.id = auth.uid()
    WHERE c.id = contract_verification_checks.contract_id
      AND (
        me.role = 'admin'
        OR (me.role IN ('manager','bookkeeper') AND c.organization_id = public.get_my_org_id())
      )
  )
);

DROP POLICY IF EXISTS "cvc_insert" ON public.contract_verification_checks;
CREATE POLICY "cvc_insert" ON public.contract_verification_checks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.profiles me ON me.id = auth.uid()
    WHERE c.id = contract_verification_checks.contract_id
      AND (
        me.role = 'admin'
        OR (me.role IN ('manager','bookkeeper') AND c.organization_id = public.get_my_org_id())
      )
  )
);

DROP POLICY IF EXISTS "cvc_update" ON public.contract_verification_checks;
CREATE POLICY "cvc_update" ON public.contract_verification_checks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.profiles me ON me.id = auth.uid()
    WHERE c.id = contract_verification_checks.contract_id
      AND (
        me.role = 'admin'
        OR (me.role IN ('manager','bookkeeper') AND c.organization_id = public.get_my_org_id())
      )
  )
);

COMMENT ON TABLE public.contract_verification_checks IS
  'One row per (contract, check_key). Stores human-confirmed verification status used by the Show Manager Verification Dashboard. Auto-derived checks are computed on read; this table holds the human override/confirmation + discrepancy notes. Lazily created on first GET of the verification API.';
