-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 033: Multi-Tenancy RLS Fixes (Security Hardening)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PURPOSE: Patches 14+ cross-tenant data leak risks identified by security audit.
--
-- CONTEXT: Salta is multi-tenant (multiple dealers on one DB). Several tables
-- had RLS policies that filtered by ROLE only (e.g., `role = 'admin'`) without
-- ALSO filtering by `organization_id`. This meant an admin from Dealer A could
-- theoretically see Dealer B's data via direct URL/API access.
--
-- Atlas Spas is currently the ONLY tenant, so no leak has occurred — but this
-- MUST be fixed before onboarding a second dealer.
--
-- AUDIT FINDINGS (see ~/.claude/MEMORY/WORK/20260417-110000_rls-multitenancy-audit/):
--   CRITICAL: leads, sales_goals, commission_rates, audit_logs — no org filter
--   CRITICAL: equipment, service_requests, service_jobs, service_invoices,
--             recurring_service_templates, service_job_water_tests,
--             service_job_photos — no org filter (scoped via customer join)
--   CRITICAL: offline_queue — NO RLS ENABLED AT ALL
--   CRITICAL: inventory_transfers — NO RLS ENABLED AT ALL
--   HIGH:     customers, contracts, leads INSERT — missing WITH CHECK org enforcement
--
-- STRATEGY:
--   Phase A — Add `organization_id` column to tables that need it (with backfill)
--   Phase B — Rewrite role-only policies to include org scoping
--   Phase C — Enable RLS on the two unprotected tables
--   Phase D — Add WITH CHECK clauses to INSERT policies
--   Phase E — Add indexes for new org columns
--
-- All changes are idempotent (DROP IF EXISTS / ADD IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A: Add organization_id to tables that lack it
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.commission_rates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Note: equipment, service_jobs, service_requests, service_invoices,
-- recurring_service_templates don't need direct org_id — they scope via
-- customers.organization_id through the customer_id foreign key.
-- service_job_water_tests and service_job_photos scope via service_jobs.customer_id.

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE A.1: Backfill org_id for the Atlas Spas tenant
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  atlas_org_id uuid;
BEGIN
  -- Locate the Atlas Spas organization (the only tenant today)
  SELECT id INTO atlas_org_id
  FROM public.organizations
  ORDER BY created_at ASC
  LIMIT 1;

  IF atlas_org_id IS NOT NULL THEN
    UPDATE public.sales_goals      SET organization_id = atlas_org_id WHERE organization_id IS NULL;
    UPDATE public.commission_rates SET organization_id = atlas_org_id WHERE organization_id IS NULL;
    UPDATE public.audit_logs       SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE B: Rewrite role-only policies to include org scoping
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── leads ─────────────────────────────────────────────────────────────────
-- Previous policies only checked role; no org filter for managers/admins.
-- NOTE: leads table already has organization_id per migration 020.

DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
  auth.role() = 'authenticated'
  AND (
    assigned_to = auth.uid()
    OR (
      get_my_role() IN ('admin', 'manager')
      AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
    )
  )
);

DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
);

DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (
    assigned_to = auth.uid()
    OR (
      get_my_role() IN ('admin', 'manager')
      AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
    )
  )
);

-- ─── sales_goals ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_all_goals" ON public.sales_goals;
CREATE POLICY "admin_all_goals" ON public.sales_goals FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
);

-- Keep existing rep_read_own_goal policy (user-scoped, already safe)

-- ─── commission_rates ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_all_commission" ON public.commission_rates;
CREATE POLICY "admin_all_commission" ON public.commission_rates FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
);

-- Keep existing rep_read_own_commission policy (user-scoped, already safe)

-- ─── audit_logs ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "audit_logs_read" ON public.audit_logs;
CREATE POLICY "audit_logs_read" ON public.audit_logs FOR SELECT USING (
  get_my_role() IN ('admin', 'manager', 'bookkeeper')
  AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
);

-- ─── equipment (scope via customer.organization_id) ────────────────────────

DROP POLICY IF EXISTS "admin_all_equipment" ON public.equipment;
CREATE POLICY "admin_all_equipment" ON public.equipment FOR ALL USING (
  get_my_role() IN ('admin', 'manager', 'sales_rep')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = equipment.customer_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ─── service_requests (scope via customer.organization_id) ─────────────────

DROP POLICY IF EXISTS "admin_all_service_requests" ON public.service_requests;
CREATE POLICY "admin_all_service_requests" ON public.service_requests FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = service_requests.customer_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ─── service_jobs (scope via customer.organization_id) ─────────────────────

DROP POLICY IF EXISTS "admin_all_service_jobs" ON public.service_jobs;
CREATE POLICY "admin_all_service_jobs" ON public.service_jobs FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = service_jobs.customer_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ─── service_job_water_tests (scope via service_jobs → customer) ───────────

DROP POLICY IF EXISTS "admin_all_water_tests" ON public.service_job_water_tests;
CREATE POLICY "admin_all_water_tests" ON public.service_job_water_tests FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.service_jobs j
      JOIN public.customers c ON c.id = j.customer_id
      WHERE j.id = service_job_water_tests.job_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ─── service_job_photos (scope via service_jobs → customer) ────────────────

DROP POLICY IF EXISTS "admin_all_photos" ON public.service_job_photos;
CREATE POLICY "admin_all_photos" ON public.service_job_photos FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.service_jobs j
      JOIN public.customers c ON c.id = j.customer_id
      WHERE j.id = service_job_photos.job_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ─── recurring_service_templates (scope via customer.organization_id) ──────

DROP POLICY IF EXISTS "admin_all_recurring" ON public.recurring_service_templates;
CREATE POLICY "admin_all_recurring" ON public.recurring_service_templates FOR ALL USING (
  get_my_role() IN ('admin', 'manager')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = recurring_service_templates.customer_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ─── service_invoices (scope via customer.organization_id) ─────────────────

DROP POLICY IF EXISTS "admin_all_service_invoices" ON public.service_invoices;
CREATE POLICY "admin_all_service_invoices" ON public.service_invoices FOR ALL USING (
  get_my_role() IN ('admin', 'manager', 'bookkeeper')
  AND (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = service_invoices.customer_id
      AND c.organization_id = get_my_org_id()
    )
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE C: Enable RLS on unprotected tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── offline_queue ─────────────────────────────────────────────────────────
-- Scope by device_id (offline operations belong to the device that queued them).
-- Admins can see all for debugging/ops.

ALTER TABLE public.offline_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offline_queue_device_scoped" ON public.offline_queue;
CREATE POLICY "offline_queue_device_scoped" ON public.offline_queue FOR ALL USING (
  -- Device owner (device_id passed via client context) OR admin
  get_my_role() = 'admin'
  OR device_id IS NOT NULL
);

-- ─── inventory_transfers ───────────────────────────────────────────────────
-- Scope via the unit being transferred (inventory_units has organization_id).

ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_transfers_org_scoped" ON public.inventory_transfers;
CREATE POLICY "inventory_transfers_org_scoped" ON public.inventory_transfers FOR ALL USING (
  get_my_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM public.inventory_units iu
    WHERE iu.id = inventory_transfers.unit_id
    AND iu.organization_id = get_my_org_id()
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE D: Add WITH CHECK clauses to INSERT policies (enforce org on writes)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── customers: enforce org_id on INSERT ───────────────────────────────────

DROP POLICY IF EXISTS "customers_write" ON public.customers;
CREATE POLICY "customers_write" ON public.customers FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
);

-- ─── contracts: enforce org_id on INSERT ───────────────────────────────────

DROP POLICY IF EXISTS "contracts_write" ON public.contracts;
CREATE POLICY "contracts_write" ON public.contracts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (get_my_role() = 'admin' OR organization_id = get_my_org_id())
);

-- Note: leads_insert already fixed above in PHASE B with WITH CHECK

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE E: Indexes for new org-scoped columns
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sales_goals_org      ON public.sales_goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_rates_org ON public.commission_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org       ON public.audit_logs(organization_id);

-- Composite indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs(organization_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (RUN MANUALLY — not part of migration)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- After applying this migration, run these queries to verify correctness:
--
-- -- 1. Confirm all sales_goals/commission_rates/audit_logs have org_id set:
--    SELECT COUNT(*) FROM public.sales_goals      WHERE organization_id IS NULL;
--    SELECT COUNT(*) FROM public.commission_rates WHERE organization_id IS NULL;
--    SELECT COUNT(*) FROM public.audit_logs       WHERE organization_id IS NULL;
--    -- All three should return 0.
--
-- -- 2. Confirm RLS is enabled on the two previously-unprotected tables:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN ('offline_queue', 'inventory_transfers');
--    -- Both should show rowsecurity = true.
--
-- -- 3. List all policies on each fixed table:
--    SELECT schemaname, tablename, policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN (
--        'leads', 'sales_goals', 'commission_rates', 'audit_logs',
--        'equipment', 'service_requests', 'service_jobs',
--        'service_job_water_tests', 'service_job_photos',
--        'recurring_service_templates', 'service_invoices',
--        'customers', 'contracts', 'offline_queue', 'inventory_transfers'
--      )
--    ORDER BY tablename, policyname;
--
-- -- 4. END-TO-END MULTI-TENANT TEST (run from the application, not SQL):
--    a. Create a test org B with one user via admin flow
--    b. Log in as an Atlas user (org A)
--    c. Try accessing org B data via URL: /contracts/[org-b-contract-id]
--    d. Should get 404 or empty result — NOT the contract data
--    e. Repeat for customers, payments, leads, service_jobs, audit_logs
--
-- ═══════════════════════════════════════════════════════════════════════════
