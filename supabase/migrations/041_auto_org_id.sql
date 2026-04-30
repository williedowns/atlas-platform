-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 041: Auto-fill organization_id on customers/contracts INSERT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ROOT CAUSE: Migration 033 added `WITH CHECK organization_id = get_my_org_id()`
-- to the customers and contracts INSERT policies. However, three insert paths
-- never set organization_id on the payload:
--   1. src/components/contracts/Step2Customer.tsx (client-side new customer)
--   2. src/app/api/contracts/route.ts             (POST /api/contracts)
--   3. src/app/api/quotes/route.ts                (POST /api/quotes)
--
-- Result: every non-admin sales rep (Robert Kennedy on 2026-04-30 QA) hit
--   "new row violates row-level security policy for table 'customers'"
--   "new row violates row-level security policy for table 'contracts'"
-- ahead of the show going live tomorrow.
--
-- FIX: BEFORE INSERT trigger that copies the inserter's org_id from their
-- profile when NEW.organization_id IS NULL. Idempotent. Does NOT overwrite
-- an explicitly-set org_id (so admin tooling that sets org_id directly
-- continues to work). Runs BEFORE the RLS WITH CHECK is evaluated, so the
-- policy now sees a populated org_id and lets the row through.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_organization_id_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_my_org_id();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_organization_id_from_profile() IS
  'BEFORE INSERT trigger fn — backfills organization_id from the inserting user''s profile when not provided, so RLS WITH CHECK clauses pass for non-admin sales reps.';

-- ─── customers ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS customers_set_org_id ON public.customers;
CREATE TRIGGER customers_set_org_id
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── contracts ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS contracts_set_org_id ON public.contracts;
CREATE TRIGGER contracts_set_org_id
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_profile();
