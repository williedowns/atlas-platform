-- ── 109_show_manager_additive.sql ──────────────────────────────────────────
-- Rework show_manager from an EXCLUSIVE scoped role into an ADDITIVE one.
--
-- New model (per Willie 2026-05-29): a show_manager is a normal sales rep who
-- ALSO gets full visibility into every deal at the shows they're assigned to
-- manage. They keep rep abilities everywhere (see their own deals, work any
-- show as a rep); manager-level "see all deals" only applies at shows where
-- they're listed in show_managers. Still NOT company-wide.
--
-- This supersedes migration 108's exclusive scoping, which made a show_manager
-- LOSE rep visibility. Here we revert the show_manager exclusions on the broad
-- reads (so they match a sales_rep) and keep ONLY the additive managed-show
-- grants (contracts/payments/overrides _show_manager policies from 108).
--
-- Idempotent — safe to re-run.
-- ---------------------------------------------------------------------------

-- ─── Revert broad reads to treat show_manager like any authenticated org user ─
-- (Same visibility a sales_rep already has. shows/customers/inventory/leads are
-- not the "books" — contracts are, and those stay scoped below.)
DROP POLICY IF EXISTS "shows_read" ON public.shows;
CREATE POLICY "shows_read" ON public.shows FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (public.get_my_role() = 'admin' OR organization_id = public.get_my_org_id())
);

DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read" ON public.customers FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (public.get_my_role() = 'admin' OR organization_id = public.get_my_org_id())
);

DROP POLICY IF EXISTS "inventory_read" ON public.inventory_units;
CREATE POLICY "inventory_read" ON public.inventory_units FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (public.get_my_role() = 'admin' OR organization_id = public.get_my_org_id())
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='leads') THEN
    DROP POLICY IF EXISTS "leads_select" ON public.leads;
    CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
      auth.role() = 'authenticated'
      AND (public.get_my_role() = 'admin' OR organization_id = public.get_my_org_id()));

    DROP POLICY IF EXISTS "leads_update" ON public.leads;
    CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
      auth.role() = 'authenticated'
      AND (public.get_my_role() = 'admin' OR organization_id = public.get_my_org_id()));

    -- Redundant now (subsumed by the org-wide read above) — drop to avoid confusion.
    DROP POLICY IF EXISTS "leads_select_show_manager" ON public.leads;
    DROP POLICY IF EXISTS "leads_update_show_manager" ON public.leads;
  END IF;
END $$;

-- ─── Contracts: restore rep self-visibility for show_manager ──────────────────
-- A show_manager sees/edits their OWN deals again (rep behavior). The additive
-- contracts_*_show_manager policies (from 108) still grant ALL deals at their
-- managed shows. Union = own deals everywhere + all deals at managed shows.
DROP POLICY IF EXISTS "contracts_read_rep" ON public.contracts;
CREATE POLICY "contracts_read_rep" ON public.contracts FOR SELECT USING (
  sales_rep_id = auth.uid()
);

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (
  sales_rep_id = auth.uid()
  OR (
    public.get_my_role() IN ('admin', 'manager')
    AND (public.get_my_role() = 'admin' OR organization_id = public.get_my_org_id())
  )
);

-- ─── Drop now-redundant scoped read policies (org-wide read covers them) ──────
DROP POLICY IF EXISTS "shows_read_show_manager" ON public.shows;
DROP POLICY IF EXISTS "customers_read_show_manager" ON public.customers;
-- KEEP from 108 (these are the additive manager value):
--   shows_update_show_manager           — edit their managed show record
--   contracts_read_show_manager         — read ALL deals at managed shows
--   contracts_update_show_manager       — edit ALL deals at managed shows
--   payments_read_show_manager          — read payments on managed-show deals
--   show_deal_overrides_*_show_manager  — workbook annotations on managed shows

-- ─── Promote the sheet's show managers to the show_manager role ───────────────
-- They keep rep abilities; manager visibility only applies at shows they're
-- assigned to (show_managers). Alex Broyles + Blake Carman are already set.
UPDATE public.profiles SET role = 'show_manager'
WHERE id IN (
  'd7e2264e-259d-4b16-b9b0-fe49d5719fdb',  -- Randy Johnson
  '1311f888-b196-4576-bb3b-b52f6e23d9e7',  -- Chip Stewart
  'db80f95d-179a-4570-bdb7-6c5a4b56c28d',  -- Ryan Frank
  'c2c872de-d17d-4239-9445-4bc21ebfdebe'   -- Mandy Stewart
);
