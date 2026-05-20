-- ── 083_per_nat_list.sql ─────────────────────────────────────────────────
-- Formalizes the long-running "Per Nat" workflow Atlas Spas has run from a
-- handwritten XLSX since 2021. Per Nat = any sold-but-not-yet-orderable spa,
-- plus any low-deposit deal that shouldn't be ordered yet. See Natalie's
-- transcript (Plans/Per Nat - Natalie 2026-05-20) for the four trigger
-- categories: future delivery, special order, low deposit, stock-held-too-long.
--
-- Three structural changes:
--
--   1. contracts.is_per_nat + contracts.per_nat_reason
--      Denormalized flag so the Per Nat list page can index a single column.
--      `per_nat_reason` is one of (low_deposit, future_delivery, special_order,
--      manual). NULL when is_per_nat = false.
--
--   2. inventory_units.stock_assigned_at
--      The clock for the 90-day stock-hold rule. Set when a unit's
--      contract_id is first populated. Backfilled approximately from
--      updated_at for already-allocated units.
--
--   3. inventory_unit_assignments history table
--      Records every assignment + release of a unit so the resold/reassigned
--      chain is queryable. Independent of audit_logs because we want a
--      structured FK to inventory_units, not generic metadata jsonb.
--
-- Backfill behavior (per Willie's directive, 2026-05-20):
--   • Auto-flag is_per_nat = true for ANY contract where status = 'low_deposit'
--     OR delivery_timeframe IS NOT NULL, provided status NOT IN
--     ('delivered','cancelled'). Reason inferred from the trigger:
--       - status='low_deposit'       → per_nat_reason='low_deposit'
--       - delivery_timeframe present → per_nat_reason='future_delivery'
--   • Stock units currently allocated: stock_assigned_at = updated_at
--     (approximate, documented in code). Grandfathered — the 90-day rule
--     applies only to NEW assignments going forward.
--   • Inventory unit assignment trigger created AFTER backfill to avoid
--     generating noise rows for historical allocations.
-- ---------------------------------------------------------------------------

-- 1. contracts.is_per_nat + contracts.per_nat_reason -------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS is_per_nat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS per_nat_reason text;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_per_nat_reason_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_per_nat_reason_check
  CHECK (
    per_nat_reason IS NULL
    OR per_nat_reason IN ('low_deposit','future_delivery','special_order','manual')
  );

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_per_nat_reason_required;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_per_nat_reason_required
  CHECK (
    (is_per_nat = false AND per_nat_reason IS NULL)
    OR (is_per_nat = true AND per_nat_reason IS NOT NULL)
  );

COMMENT ON COLUMN public.contracts.is_per_nat IS
  'Denormalized Per Nat flag. True when this contract is on the Per Nat list — a sale held back from factory ordering because of timing, low deposit, or special configuration. Maintained by app code, not a DB trigger.';

COMMENT ON COLUMN public.contracts.per_nat_reason IS
  'Why this contract is on the Per Nat list. One of: low_deposit, future_delivery, special_order, manual. NULL when is_per_nat = false.';

-- Partial index — Per Nat list query filters on is_per_nat = true.
CREATE INDEX IF NOT EXISTS idx_contracts_is_per_nat
  ON public.contracts(is_per_nat)
  WHERE is_per_nat = true;

-- 2. inventory_units.stock_assigned_at ---------------------------------------

ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS stock_assigned_at timestamptz;

COMMENT ON COLUMN public.inventory_units.stock_assigned_at IS
  'Timestamp when this unit''s contract_id was first populated. Starts the 90-day stock-hold clock. NULL when unit is not currently assigned to any contract.';

CREATE INDEX IF NOT EXISTS idx_inventory_units_stock_assigned_at
  ON public.inventory_units(stock_assigned_at)
  WHERE stock_assigned_at IS NOT NULL;

-- 3. inventory_unit_assignments history --------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_unit_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_unit_id uuid NOT NULL REFERENCES public.inventory_units(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_unit_assignments IS
  'History of every assignment + release for an inventory unit. Used to trace the resold/reassigned chain (customer A bought it, released, customer B bought it). Separate from audit_logs because the FK relationships are queryable.';

CREATE INDEX IF NOT EXISTS idx_iua_unit
  ON public.inventory_unit_assignments(inventory_unit_id);
CREATE INDEX IF NOT EXISTS idx_iua_contract
  ON public.inventory_unit_assignments(contract_id);
CREATE INDEX IF NOT EXISTS idx_iua_open
  ON public.inventory_unit_assignments(inventory_unit_id)
  WHERE released_at IS NULL;

ALTER TABLE public.inventory_unit_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "iua_read" ON public.inventory_unit_assignments;
CREATE POLICY "iua_read" ON public.inventory_unit_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin','manager','bookkeeper','sales_rep','show_manager')
    )
  );

DROP POLICY IF EXISTS "iua_write" ON public.inventory_unit_assignments;
CREATE POLICY "iua_write" ON public.inventory_unit_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin','manager')
    )
  );

-- 4. Backfill ----------------------------------------------------------------

-- 4a. Per Nat backfill: flag matching contracts.
UPDATE public.contracts
SET is_per_nat = true,
    per_nat_reason = 'low_deposit'
WHERE status = 'low_deposit'
  AND status NOT IN ('delivered','cancelled')
  AND is_per_nat = false;

UPDATE public.contracts
SET is_per_nat = true,
    per_nat_reason = 'future_delivery'
WHERE delivery_timeframe IS NOT NULL
  AND status NOT IN ('delivered','cancelled')
  AND is_per_nat = false;

-- 4b. stock_assigned_at backfill — approximate from updated_at for currently-allocated units.
UPDATE public.inventory_units
SET stock_assigned_at = updated_at
WHERE contract_id IS NOT NULL
  AND stock_assigned_at IS NULL;

-- 4c. Seed inventory_unit_assignments for currently-allocated units so the
--     history table has a row for every open assignment. Without this, the
--     first time a unit is released we'd be missing the "when was it assigned"
--     half of the chain. Uses the same approximate timestamp.
INSERT INTO public.inventory_unit_assignments (inventory_unit_id, contract_id, assigned_at)
SELECT id, contract_id, COALESCE(stock_assigned_at, updated_at)
FROM public.inventory_units
WHERE contract_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_unit_assignments iua
    WHERE iua.inventory_unit_id = public.inventory_units.id
      AND iua.released_at IS NULL
  );

-- 5. Trigger for future assignment changes -----------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_unit_assignment_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- contract_id changed (assigned, released, or reassigned).
  IF NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
    -- Close any open assignment row for this unit (release).
    UPDATE public.inventory_unit_assignments
    SET released_at = now(),
        released_by = NULLIF(current_setting('app.actor_id', true), '')::uuid
    WHERE inventory_unit_id = NEW.id
      AND released_at IS NULL;

    -- Open a new assignment if contract_id is being set (assignment).
    IF NEW.contract_id IS NOT NULL THEN
      INSERT INTO public.inventory_unit_assignments (inventory_unit_id, contract_id)
      VALUES (NEW.id, NEW.contract_id);

      -- Start the 90-day stock-hold clock if not already set.
      IF NEW.stock_assigned_at IS NULL THEN
        NEW.stock_assigned_at = now();
      END IF;
    ELSE
      -- Release: clear the clock so it restarts if reassigned later.
      NEW.stock_assigned_at = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_unit_assignment_history ON public.inventory_units;
CREATE TRIGGER trg_inventory_unit_assignment_history
  BEFORE UPDATE OF contract_id ON public.inventory_units
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inventory_unit_assignment_history();

COMMENT ON FUNCTION public.fn_inventory_unit_assignment_history IS
  'Maintains the inventory_unit_assignments history table whenever inventory_units.contract_id changes. Reads app.actor_id session GUC to attribute the release. App code should SET LOCAL app.actor_id = ''<uuid>'' inside the transaction.';
