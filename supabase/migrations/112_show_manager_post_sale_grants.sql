-- ── 112_show_manager_post_sale_grants.sql ───────────────────────────────────
-- Issue 4/7 ("Full, except delete" — Blake, May 2026 show floor): a show_manager
-- already edits the core contract fields for deals at shows they manage (108/109).
-- Atlas decided they should also get the rest of the post-sale surface for those
-- same deals — record a refund, override the delivery-readiness gate, schedule a
-- delivery, and read the contract audit trail. Everything EXCEPT delete.
--
-- The UI gates (contracts/[id]/page.tsx) and the API guards
-- (auth-guard.userManagesContractShow + contract-access.canActOnContract) now
-- admit show_manager on these surfaces. Two of them read/write under the
-- CALLER's RLS, so without matching policies the control would render but the
-- query would silently return nothing / the write would be rejected — the
-- 108/109 paired-migration trap. This migration supplies the RLS half.
--
-- Additive + idempotent. Permissive policies are OR'd, so each policy below can
-- only WIDEN access: nothing that can read/write today loses anything, and no
-- signed-contract data is touched.
--
--   1. audit_logs            — show_manager SELECT, scoped to 'contract' rows
--                              whose contract was sold at a show they manage.
--   2. delivery_work_orders  — show_manager SELECT / INSERT / UPDATE (NOT
--                              delete), scoped to deals at a show they manage.
--
-- NOTE on delivery_work_orders: this table has RLS enabled (001) but its working
-- admin/manager policies were created in the Supabase dashboard, not in a
-- migration. The policies below name show_manager only and are additive, so they
-- cannot affect the existing dashboard policies in either direction. Run the
-- DIAGNOSTIC block at the bottom first if you want to see the current set.
-- ---------------------------------------------------------------------------

-- ─── 1. audit_logs: show_manager reads the trail for their shows' deals ──────
-- entity_id is uuid (011), so it joins to contracts.id directly. Scoping to
-- entity_type = 'contract' keeps non-contract audit rows invisible.
DROP POLICY IF EXISTS "audit_logs_read_show_manager" ON public.audit_logs;
CREATE POLICY "audit_logs_read_show_manager" ON public.audit_logs FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND entity_type = 'contract'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = audit_logs.entity_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

COMMENT ON POLICY "audit_logs_read_show_manager" ON public.audit_logs IS
  'Additive (112): show_manager reads contract audit entries for deals at shows they manage. Pairs with 033 audit_logs_read (admin/manager/bookkeeper). Scoped to entity_type=contract; entity_id is uuid.';

-- ─── 2. delivery_work_orders: show_manager schedule / override / read ────────
DROP POLICY IF EXISTS "delivery_work_orders_read_show_manager" ON public.delivery_work_orders;
CREATE POLICY "delivery_work_orders_read_show_manager" ON public.delivery_work_orders FOR SELECT USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = delivery_work_orders.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

DROP POLICY IF EXISTS "delivery_work_orders_insert_show_manager" ON public.delivery_work_orders;
CREATE POLICY "delivery_work_orders_insert_show_manager" ON public.delivery_work_orders FOR INSERT WITH CHECK (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = delivery_work_orders.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

DROP POLICY IF EXISTS "delivery_work_orders_update_show_manager" ON public.delivery_work_orders;
CREATE POLICY "delivery_work_orders_update_show_manager" ON public.delivery_work_orders FOR UPDATE USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = delivery_work_orders.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
) WITH CHECK (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = delivery_work_orders.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

COMMENT ON POLICY "delivery_work_orders_read_show_manager" ON public.delivery_work_orders IS
  'Additive (112): show_manager reads/schedules/updates (not deletes) delivery work orders for deals at shows they manage. See insert/update siblings.';

-- ─── DIAGNOSTIC (optional, read-only) ────────────────────────────────────────
-- Run this to see every policy currently on the tables this feature touches —
-- useful to confirm the dashboard-created delivery_work_orders policies before
-- and after applying the above.
/*
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('delivery_work_orders', 'audit_logs', 'payments')
ORDER BY tablename, policyname;
*/

-- ─── ROLLBACK (run to revert) ────────────────────────────────────────────────
/*
DROP POLICY IF EXISTS "audit_logs_read_show_manager" ON public.audit_logs;
DROP POLICY IF EXISTS "delivery_work_orders_read_show_manager" ON public.delivery_work_orders;
DROP POLICY IF EXISTS "delivery_work_orders_insert_show_manager" ON public.delivery_work_orders;
DROP POLICY IF EXISTS "delivery_work_orders_update_show_manager" ON public.delivery_work_orders;
*/
