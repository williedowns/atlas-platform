-- ── 020_rls_org_scoping.sql ─────────────────────────────────────────────────
-- Phase 2 multi-tenancy: add organization_id scoping to all RLS policies.
-- Each tenant only sees their own org's data.
-- Admins bypass org filter and can see all data (super-admin pattern).
--
-- ⚠️  IMPORTANT: Run this migration ONLY after verifying all users have org set.
--   Check first:  SELECT COUNT(*) FROM profiles WHERE organization_id IS NULL;
--   Result must be 0 before running.
--
-- This migration is IDEMPOTENT — safe to run multiple times.
-- ---------------------------------------------------------------------------

-- Helper: returns the org_id of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Note: admin check uses alias 'p' to avoid infinite recursion on profiles self-join

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  OR organization_id = public.get_my_org_id()
);

-- update_own stays unchanged — users can only update their own row
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (
  auth.uid() = id
);

-- ─── locations ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "locations_read" ON public.locations;
CREATE POLICY "locations_read" ON public.locations FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "locations_write" ON public.locations;
-- Original was "shows_write" pattern — locations had no write policy in 001; add one now
CREATE POLICY "locations_write" ON public.locations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND (organization_id = public.get_my_org_id() OR role = 'admin')
  )
);

-- ─── shows ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "shows_read" ON public.shows;
CREATE POLICY "shows_read" ON public.shows FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "shows_write" ON public.shows;
CREATE POLICY "shows_write" ON public.shows FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND (role = 'admin' OR organization_id = public.get_my_org_id())
  )
);

-- ─── customers ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read" ON public.customers FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "customers_write" ON public.customers;
CREATE POLICY "customers_write" ON public.customers FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

-- ─── contracts ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "contracts_read_admin" ON public.contracts;
CREATE POLICY "contracts_read_admin" ON public.contracts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'bookkeeper')
      AND (role = 'admin' OR organization_id = public.get_my_org_id())
  )
);

DROP POLICY IF EXISTS "contracts_read_rep" ON public.contracts;
CREATE POLICY "contracts_read_rep" ON public.contracts FOR SELECT USING (
  -- Reps always see their own contracts regardless of org (safety net)
  sales_rep_id = auth.uid()
);

DROP POLICY IF EXISTS "contracts_write" ON public.contracts;
CREATE POLICY "contracts_write" ON public.contracts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (
  sales_rep_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND (role = 'admin' OR organization_id = public.get_my_org_id())
  )
);

-- ─── inventory_units ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "inventory_read" ON public.inventory_units;
CREATE POLICY "inventory_read" ON public.inventory_units FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "inventory_write" ON public.inventory_units;
CREATE POLICY "inventory_write" ON public.inventory_units FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND (role = 'admin' OR organization_id = public.get_my_org_id())
  )
);

-- ─── leads (conditional — table may not exist yet) ──────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'leads'
  ) THEN
    DROP POLICY IF EXISTS "leads_select" ON public.leads;
    CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
      auth.role() = 'authenticated'
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR organization_id = public.get_my_org_id()
      )
    );

    DROP POLICY IF EXISTS "leads_insert" ON public.leads;
    CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
      auth.role() = 'authenticated'
    );

    DROP POLICY IF EXISTS "leads_update" ON public.leads;
    CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
      auth.role() = 'authenticated'
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR organization_id = public.get_my_org_id()
      )
    );
  END IF;
END $$;

-- ─── Intentionally excluded ─────────────────────────────────────────────────
-- products          — shared catalog, no org scoping (all tenants share products)
-- payments          — complex join-based policy, leave as-is
-- delivery_work_orders — leave as-is

-- ─── ROLLBACK (run this block to revert to pre-org policies) ────────────────
/*
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "locations_read" ON public.locations;
CREATE POLICY "locations_read" ON public.locations FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "shows_read" ON public.shows;
CREATE POLICY "shows_read" ON public.shows FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "shows_write" ON public.shows;
CREATE POLICY "shows_write" ON public.shows FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read" ON public.customers FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "customers_write" ON public.customers;
CREATE POLICY "customers_write" ON public.customers FOR INSERT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "contracts_read_admin" ON public.contracts;
CREATE POLICY "contracts_read_admin" ON public.contracts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager','bookkeeper'))
);

DROP POLICY IF EXISTS "contracts_read_rep" ON public.contracts;
CREATE POLICY "contracts_read_rep" ON public.contracts FOR SELECT USING (sales_rep_id = auth.uid());

DROP POLICY IF EXISTS "contracts_write" ON public.contracts;
CREATE POLICY "contracts_write" ON public.contracts FOR INSERT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (
  sales_rep_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

DROP POLICY IF EXISTS "inventory_read" ON public.inventory_units;
CREATE POLICY "inventory_read" ON public.inventory_units FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "inventory_write" ON public.inventory_units;
CREATE POLICY "inventory_write" ON public.inventory_units FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);
*/
