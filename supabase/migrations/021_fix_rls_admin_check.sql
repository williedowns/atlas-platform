-- ── 021_fix_rls_admin_check.sql ─────────────────────────────────────────────
-- Fix: replace self-referential admin check in profiles RLS with a
-- SECURITY DEFINER helper function (same pattern as get_my_org_id).
-- The inline EXISTS(SELECT FROM profiles) inside profiles RLS can cause
-- Supabase to return unexpected results due to recursive policy evaluation.
-- ---------------------------------------------------------------------------

-- Helper: returns the role of the currently authenticated user
-- SECURITY DEFINER bypasses RLS entirely when reading profiles
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── Re-apply all policies that used the self-referential admin check ────────

-- profiles
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (
  public.get_my_role() = 'admin'
  OR organization_id = public.get_my_org_id()
);

-- locations
DROP POLICY IF EXISTS "locations_read" ON public.locations;
CREATE POLICY "locations_read" ON public.locations FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "locations_write" ON public.locations;
CREATE POLICY "locations_write" ON public.locations FOR ALL USING (
  public.get_my_role() IN ('admin', 'manager')
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

-- shows
DROP POLICY IF EXISTS "shows_read" ON public.shows;
CREATE POLICY "shows_read" ON public.shows FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "shows_write" ON public.shows;
CREATE POLICY "shows_write" ON public.shows FOR ALL USING (
  public.get_my_role() IN ('admin', 'manager')
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

-- customers
DROP POLICY IF EXISTS "customers_read" ON public.customers;
CREATE POLICY "customers_read" ON public.customers FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

-- contracts
DROP POLICY IF EXISTS "contracts_read_admin" ON public.contracts;
CREATE POLICY "contracts_read_admin" ON public.contracts FOR SELECT USING (
  public.get_my_role() IN ('admin', 'manager', 'bookkeeper')
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE USING (
  sales_rep_id = auth.uid()
  OR (
    public.get_my_role() IN ('admin', 'manager')
    AND (
      public.get_my_role() = 'admin'
      OR organization_id = public.get_my_org_id()
    )
  )
);

-- inventory_units
DROP POLICY IF EXISTS "inventory_read" ON public.inventory_units;
CREATE POLICY "inventory_read" ON public.inventory_units FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "inventory_write" ON public.inventory_units;
CREATE POLICY "inventory_write" ON public.inventory_units FOR ALL USING (
  public.get_my_role() IN ('admin', 'manager')
  AND (
    public.get_my_role() = 'admin'
    OR organization_id = public.get_my_org_id()
  )
);

-- leads (conditional)
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
        OR organization_id = public.get_my_org_id()
      )
    );

    DROP POLICY IF EXISTS "leads_update" ON public.leads;
    CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
      auth.role() = 'authenticated'
      AND (
        public.get_my_role() = 'admin'
        OR organization_id = public.get_my_org_id()
      )
    );
  END IF;
END $$;
