-- ── 108_show_manager_scoping.sql ────────────────────────────────────────────
-- Scoped "show_manager" role.
--
-- A show_manager sees ONLY the shows they manage (past and current) and the
-- deals/contracts sold at those shows. They get full edit on their shows'
-- contracts. They must NOT see company-wide books, contracts, inventory, or
-- analytics.
--
-- Implementation:
--   1. show_managers junction (user <-> show, many-to-many).
--   2. manages_show() SECURITY DEFINER helper (reads the junction past RLS).
--   3. Tighten the broad org-wide read policies so show_manager is excluded:
--      shows_read, customers_read, inventory_read, leads_select, leads_update.
--      (Postgres ORs permissive policies, so a scoped policy alone can't narrow
--      an existing broad grant — the broad grant must drop show_manager.)
--   4. Add show_manager-scoped policies for shows, contracts, customers, leads,
--      payments, and show_deal_overrides — each gated through manages_show().
--
-- Idempotent — safe to re-run.
-- ---------------------------------------------------------------------------

-- ─── 1. Junction table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.show_managers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Denormalized for query convenience; RLS derives org via the shows join so
  -- a NULL here can never widen access (known service-role-insert NULL gotcha).
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_show_managers_user ON public.show_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_show_managers_show ON public.show_managers(show_id);

-- ─── 2. Membership helper ─────────────────────────────────────────────────────
-- SECURITY DEFINER so it reads show_managers regardless of the caller's RLS,
-- and so other tables' policies don't have to reference show_managers directly
-- (avoids cross-table RLS recursion).
CREATE OR REPLACE FUNCTION public.manages_show(p_show_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.show_managers sm
    WHERE sm.user_id = auth.uid()
      AND sm.show_id = p_show_id
  );
$$;

-- ─── 3. RLS on the junction itself ────────────────────────────────────────────
ALTER TABLE public.show_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "show_managers_read" ON public.show_managers;
CREATE POLICY "show_managers_read" ON public.show_managers FOR SELECT USING (
  public.get_my_role() = 'admin'
  OR user_id = auth.uid()
  OR (
    public.get_my_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.shows s
      WHERE s.id = show_managers.show_id
        AND s.organization_id = public.get_my_org_id()
    )
  )
);

DROP POLICY IF EXISTS "show_managers_write" ON public.show_managers;
CREATE POLICY "show_managers_write" ON public.show_managers FOR ALL USING (
  public.get_my_role() = 'admin'
  OR (
    public.get_my_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.shows s
      WHERE s.id = show_managers.show_id
        AND s.organization_id = public.get_my_org_id()
    )
  )
) WITH CHECK (
  public.get_my_role() = 'admin'
  OR (
    public.get_my_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.shows s
      WHERE s.id = show_managers.show_id
        AND s.organization_id = public.get_my_org_id()
    )
  )
);

-- ─── 4. Tighten broad org-wide reads to EXCLUDE show_manager ──────────────────
-- shows: show_manager no longer gets the org-wide grant; scoped policy below.
DROP POLICY IF EXISTS "shows_read" ON public.shows;
CREATE POLICY "shows_read" ON public.shows FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'show_manager')
  )
);

-- customers: same — scoped re-grant below limits to managed-show customers.
DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read" ON public.customers FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'show_manager')
  )
);

-- contracts: the pre-existing self-ownership branches (sales_rep_id = auth.uid())
-- must also exclude show_manager — otherwise a show_manager who personally sold
-- a deal would see/edit it at ANY show, escaping the managed-show scope. The
-- scoped contracts_*_show_manager policies below re-grant the correct set.
DROP POLICY IF EXISTS "contracts_read_rep" ON public.contracts;
CREATE POLICY "contracts_read_rep" ON public.contracts FOR SELECT USING (
  sales_rep_id = auth.uid()
  AND public.get_my_role() <> 'show_manager'
);

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (
  (sales_rep_id = auth.uid() AND public.get_my_role() <> 'show_manager')
  OR (
    public.get_my_role() IN ('admin', 'manager')
    AND (
      public.get_my_role() = 'admin'
      OR organization_id = public.get_my_org_id()
    )
  )
);

-- inventory: show_manager gets NO inventory access (no scoped re-grant).
DROP POLICY IF EXISTS "inventory_read" ON public.inventory_units;
CREATE POLICY "inventory_read" ON public.inventory_units FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'show_manager')
  )
);

-- leads: tighten read + update; scoped re-grants below limit to managed shows.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    DROP POLICY IF EXISTS "leads_select" ON public.leads;
    CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
      auth.role() = 'authenticated'
      AND (
        public.get_my_role() = 'admin'
        OR (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'show_manager')
      )
    );

    DROP POLICY IF EXISTS "leads_update" ON public.leads;
    CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
      auth.role() = 'authenticated'
      AND (
        public.get_my_role() = 'admin'
        OR (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'show_manager')
      )
    );

    DROP POLICY IF EXISTS "leads_select_show_manager" ON public.leads;
    CREATE POLICY "leads_select_show_manager" ON public.leads FOR SELECT USING (
      public.get_my_role() = 'show_manager'
      AND show_id IS NOT NULL
      AND public.manages_show(show_id)
    );

    DROP POLICY IF EXISTS "leads_update_show_manager" ON public.leads;
    CREATE POLICY "leads_update_show_manager" ON public.leads FOR UPDATE USING (
      public.get_my_role() = 'show_manager'
      AND show_id IS NOT NULL
      AND public.manages_show(show_id)
    );
  END IF;
END $$;

-- ─── 5. show_manager-scoped grants ────────────────────────────────────────────
-- Shows: only the shows they manage.
DROP POLICY IF EXISTS "shows_read_show_manager" ON public.shows;
CREATE POLICY "shows_read_show_manager" ON public.shows FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND public.manages_show(id)
);

DROP POLICY IF EXISTS "shows_update_show_manager" ON public.shows;
CREATE POLICY "shows_update_show_manager" ON public.shows FOR UPDATE USING (
  public.get_my_role() = 'show_manager'
  AND public.manages_show(id)
);

-- Contracts: only deals sold at a managed show (show_id must be set + managed).
DROP POLICY IF EXISTS "contracts_read_show_manager" ON public.contracts;
CREATE POLICY "contracts_read_show_manager" ON public.contracts FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND show_id IS NOT NULL
  AND public.manages_show(show_id)
);

DROP POLICY IF EXISTS "contracts_update_show_manager" ON public.contracts;
CREATE POLICY "contracts_update_show_manager" ON public.contracts FOR UPDATE USING (
  public.get_my_role() = 'show_manager'
  AND show_id IS NOT NULL
  AND public.manages_show(show_id)
) WITH CHECK (
  -- The post-update row must still belong to a show they manage — blocks
  -- moving a deal to a show they don't run.
  public.get_my_role() = 'show_manager'
  AND show_id IS NOT NULL
  AND public.manages_show(show_id)
);

-- Customers: only customers who appear on a contract at a managed show.
DROP POLICY IF EXISTS "customers_read_show_manager" ON public.customers;
CREATE POLICY "customers_read_show_manager" ON public.customers FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.customer_id = customers.id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

-- Payments: only payments on a managed show's contracts.
DROP POLICY IF EXISTS "payments_read_show_manager" ON public.payments;
CREATE POLICY "payments_read_show_manager" ON public.payments FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = payments.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

-- Show-deal overrides (the workbook annotations): read + write on managed shows.
DROP POLICY IF EXISTS "show_deal_overrides_read_show_manager" ON public.show_deal_overrides;
CREATE POLICY "show_deal_overrides_read_show_manager" ON public.show_deal_overrides FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = show_deal_overrides.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

DROP POLICY IF EXISTS "show_deal_overrides_insert_show_manager" ON public.show_deal_overrides;
CREATE POLICY "show_deal_overrides_insert_show_manager" ON public.show_deal_overrides FOR INSERT WITH CHECK (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = show_deal_overrides.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

DROP POLICY IF EXISTS "show_deal_overrides_update_show_manager" ON public.show_deal_overrides;
CREATE POLICY "show_deal_overrides_update_show_manager" ON public.show_deal_overrides FOR UPDATE USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = show_deal_overrides.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

-- ─── ROLLBACK (run to revert) ─────────────────────────────────────────────────
/*
DROP POLICY IF EXISTS "shows_read_show_manager" ON public.shows;
DROP POLICY IF EXISTS "shows_update_show_manager" ON public.shows;
DROP POLICY IF EXISTS "contracts_read_show_manager" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update_show_manager" ON public.contracts;
DROP POLICY IF EXISTS "customers_read_show_manager" ON public.customers;
DROP POLICY IF EXISTS "payments_read_show_manager" ON public.payments;
DROP POLICY IF EXISTS "show_deal_overrides_read_show_manager" ON public.show_deal_overrides;
DROP POLICY IF EXISTS "show_deal_overrides_insert_show_manager" ON public.show_deal_overrides;
DROP POLICY IF EXISTS "show_deal_overrides_update_show_manager" ON public.show_deal_overrides;
DROP POLICY IF EXISTS "leads_select_show_manager" ON public.leads;
DROP POLICY IF EXISTS "leads_update_show_manager" ON public.leads;
-- Restore broad reads (re-run 021 definitions) to re-include show_manager in org grants.
DROP FUNCTION IF EXISTS public.manages_show(uuid);
DROP TABLE IF EXISTS public.show_managers;
*/
