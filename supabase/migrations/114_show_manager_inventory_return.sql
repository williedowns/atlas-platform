-- ── 114_show_manager_inventory_return.sql ──────────────────────────────────
-- SUPERSEDED BY 115: migration 115 replaces this file's release-only
-- `inventory_update_show_manager` with a comprehensive assign+release policy.
-- If you are applying fresh, 115 alone is sufficient (it DROP/CREATEs the same
-- policy name). This file is retained for history. Its note below that
-- "show_manager has NO inventory read" reflects 108 and is stale post-109.
--
-- Follow-up to 108/109/112 ("Full, except delete" — show_manager). Atlas
-- confirmed a show_manager may CANCEL a deal at a show they manage; only DELETE
-- stays admin-only (DELETE handler in api/contracts/[id]/route.ts is unchanged).
--
-- The cancel route (api/contracts/[id]/cancel) does two writes under the
-- CALLER's RLS:
--   1. contracts.status -> 'cancelled'  — already allowed by 108's
--      contracts_update_show_manager, so this works for show_manager today.
--   2. inventory_units -> return allocated units to stock
--      (status='at_location', contract_id=NULL).
-- Step 2 has no show_manager policy today: inventory_write (021) is admin/manager
-- only, and 108 deliberately gave show_manager NO inventory access. The cancel
-- route swallows the inventory error (`if (!invError)`), so without this policy a
-- show_manager cancel of a deal that already had a unit assigned would silently
-- strand that unit as 'allocated'. This migration supplies the missing write.
--
-- Additive + idempotent. Permissive policies are OR'd, so this only WIDENS:
-- inventory_read (108) and inventory_write (021) are untouched; admin/manager
-- inventory access is unchanged. show_manager's READ scope is NOT widened — they
-- still cannot browse inventory. This grants UPDATE only, and only on units
-- currently tied to a contract at a show they manage.
--
-- WITH CHECK asymmetry (important): the cancel write sets contract_id = NULL, so
-- the POST-update row no longer references a managed-show contract. If WITH CHECK
-- repeated the USING predicate it would REJECT the release. USING scopes WHICH
-- units are targetable (those on the show_manager's managed-show deals); WITH
-- CHECK only requires the released row stay inside their org — which holds, since
-- the cancel write changes status + contract_id but not organization_id.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "inventory_update_show_manager" ON public.inventory_units;
CREATE POLICY "inventory_update_show_manager" ON public.inventory_units FOR UPDATE USING (
  public.get_my_role() = 'show_manager'
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = inventory_units.contract_id
      AND c.show_id IS NOT NULL
      AND public.manages_show(c.show_id)
  )
) WITH CHECK (
  public.get_my_role() = 'show_manager'
  AND organization_id = public.get_my_org_id()
);

COMMENT ON POLICY "inventory_update_show_manager" ON public.inventory_units IS
  'Additive (114): show_manager may UPDATE inventory units currently tied to a contract at a show they manage — to return units to stock when cancelling that deal. USING scopes targetable rows to managed-show deals; WITH CHECK only requires the row stay in-org so the contract_id=NULL release passes. Pairs with inventory_write (021, admin/manager) and inventory_read (108). Does NOT grant inventory READ.';

-- ─── DIAGNOSTIC (optional, read-only) ────────────────────────────────────────
-- Confirm the full inventory_units policy set before/after applying.
/*
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'inventory_units'
ORDER BY policyname;
*/

-- ─── ROLLBACK (run to revert) ────────────────────────────────────────────────
/*
DROP POLICY IF EXISTS "inventory_update_show_manager" ON public.inventory_units;
*/
