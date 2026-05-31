-- ── 115_show_manager_inventory_assign.sql ─────────────────────────────────
-- "Full, except delete" — final inventory grant for show_manager. Atlas
-- confirmed a show_manager may edit EVERY element of a signed contract at a
-- show they manage, including ASSIGNING and RELEASING a stock unit. Only DELETE
-- of the contract stays admin-only.
--
-- This migration finishes the inventory side of that. Two writes happen when a
-- show_manager tags/untags a unit (both under the CALLER's RLS):
--   A. inventory_units UPDATE  — set/clear contract_id + status.
--   B. inventory_unit_assignments INSERT/UPDATE — the history row, written by
--      the BEFORE-UPDATE trigger fn_inventory_unit_assignment_history (083),
--      which is plain plpgsql (SECURITY INVOKER) so it runs as the show_manager.
--
-- Prereqs already in place (verified in the migration set):
--   * inventory READ: migration 109's `inventory_read` is org-wide for every
--     authenticated role (admin OR org-match — the show_manager exclusion that
--     108 added at its line 141 was dropped by 109). So a show_manager can
--     already SELECT their org's units; the /api/inventory/search typeahead only
--     needed its route gate opened (done in code). NO read policy is added here.
--     (NOTE: migration 114's header comment that "show_manager has NO inventory
--      read" describes 108's state and is stale post-109 — corrected here.)
--   * status -> cancelled / contract edits: migration 108 contracts policies.
--
-- ── A. inventory_units UPDATE — supersede 114 with assign + release ──────────
-- 114 created a RELEASE-ONLY `inventory_update_show_manager` (USING = unit on a
-- managed-show deal; WITH CHECK = org-only, so the contract_id=NULL release
-- passes). Adding a SEPARATE assign policy would be UNSAFE: permissive policies
-- OR their WITH CHECKs, and 114's org-only WITH CHECK would then let a
-- show_manager attach a unit to ANY org contract — including shows they don't
-- manage. So instead we REPLACE 114's policy with one comprehensive policy whose
-- USING and WITH CHECK both gate BOTH directions, leaving no loose branch.
--
-- DROP IF EXISTS makes this safe whether or not 114 was applied: the end state
-- is the single comprehensive policy either way. (If you have NOT yet applied
-- 114 to prod, you can skip it — this migration alone covers the cancel-release
-- case 114 was written for, plus assign.)
--
--   USING  (which existing rows a show_manager may target):
--     org unit that is EITHER unassigned (contract_id IS NULL, available to tag)
--     OR currently on one of their managed-show deals (available to release/move).
--   WITH CHECK (what the row may become):
--     released to stock (contract_id IS NULL) OR attached to one of their
--     managed-show deals. Attaching to an unmanaged/other-org contract is blocked
--     because neither branch holds.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "inventory_update_show_manager" ON public.inventory_units;
CREATE POLICY "inventory_update_show_manager" ON public.inventory_units FOR UPDATE USING (
  public.get_my_role() = 'show_manager'
  AND organization_id = public.get_my_org_id()
  AND (
    contract_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = inventory_units.contract_id
        AND c.show_id IS NOT NULL
        AND public.manages_show(c.show_id)
    )
  )
) WITH CHECK (
  public.get_my_role() = 'show_manager'
  AND organization_id = public.get_my_org_id()
  AND (
    contract_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = inventory_units.contract_id
        AND c.show_id IS NOT NULL
        AND public.manages_show(c.show_id)
    )
  )
);

COMMENT ON POLICY "inventory_update_show_manager" ON public.inventory_units IS
  'Additive (115, supersedes 114 release-only): show_manager may UPDATE inventory units to ASSIGN an unassigned org unit to one of their managed-show deals, or RELEASE a unit back to stock from such a deal. USING + WITH CHECK both gate both directions (contract_id IS NULL OR managed-show contract) so a unit can never be attached to an unmanaged/other-org contract. Pairs with inventory_read (109, org-wide) and inventory_write (021, admin/manager). Does not grant READ beyond 109.';

-- ── B. inventory_unit_assignments — let the history trigger write as a SM ────
-- The trigger (083) INSERTs a new history row on assign and UPDATEs the open row
-- on release, running as the show_manager. iua_write (083) is admin/manager only,
-- so without this the trigger INSERT raises an RLS error and the whole assign
-- aborts (an INSERT that fails WITH CHECK errors — it does not silently no-op).
-- The route's own released_by / release_reason backfills on the history row also
-- run as the show_manager and need this same grant.
--
-- Scoped TIGHTER than the inventory_units policy above: only history rows whose
-- contract_id is one of the show_manager's managed-show deals. The history table
-- has no organization_id column, so scope is expressed purely through the
-- contract -> show -> manages_show() chain. manages_show() is SECURITY DEFINER
-- (108) so it resolves membership regardless of the caller's RLS.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "iua_write_show_manager" ON public.inventory_unit_assignments;
CREATE POLICY "iua_write_show_manager" ON public.inventory_unit_assignments FOR ALL USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = inventory_unit_assignments.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
) WITH CHECK (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = inventory_unit_assignments.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
);

COMMENT ON POLICY "iua_write_show_manager" ON public.inventory_unit_assignments IS
  'Additive (115): show_manager may INSERT/UPDATE inventory_unit_assignments history rows whose contract_id is one of their managed-show deals. Needed so the SECURITY-INVOKER history trigger (083) can write the assign/release row, and so the route can backfill released_by/release_reason, when a show_manager tags or untags a unit. Pairs with iua_write (083, admin/manager) and iua_read (083, all internal roles).';

-- ─── DIAGNOSTIC (optional, read-only) ────────────────────────────────────────
-- 1) Confirm inventory_read is org-wide for show_manager (should NOT contain the
--    "<> 'show_manager'" exclusion — if it does, migration 109 was never applied
--    and search will 403 at the RLS layer even after the route gate is opened).
/*
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'inventory_units' AND policyname = 'inventory_read';
*/
-- 2) Full policy set after applying (inventory_units + the history table).
/*
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('inventory_units','inventory_unit_assignments')
ORDER BY tablename, policyname;
*/

-- ─── ROLLBACK (run to revert to the 114 release-only behavior) ───────────────
/*
DROP POLICY IF EXISTS "iua_write_show_manager" ON public.inventory_unit_assignments;
DROP POLICY IF EXISTS "inventory_update_show_manager" ON public.inventory_units;
-- then re-run migration 114 to restore the release-only policy, if desired.
*/
