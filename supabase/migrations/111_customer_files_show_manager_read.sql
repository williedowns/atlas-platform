-- ── 111_customer_files_show_manager_read.sql ───────────────────────────────
-- Issue 3 (Blake, May 2026 show floor): a driver's license uploaded on the
-- iPad shows as "missing" when a show_manager reviews the deal on a laptop,
-- and the delivery-readiness gate shows a false "driver's license missing"
-- blocker for those deals.
--
-- Root cause: customer_files_read (migration 040) grants read to
-- admin/manager/bookkeeper, the contract's OWN sales_rep, or the uploader —
-- but NOT to a show_manager. Under the additive show_manager model (109) a
-- show_manager has manager-level visibility into every deal at the shows they
-- run, INCLUDING deals another rep sold. Both the customer-files API and the
-- readiness DL check read this table under the CALLER's RLS, so the file row is
-- invisible to a show_manager viewing another rep's deal at their own show.
--
-- Fix: ADD a permissive SELECT policy. Postgres ORs permissive policies, so
-- this only WIDENS access — the 040 policy is left untouched and nothing that
-- can read today loses access. Scoped (like 040's sales_rep clause) by the
-- customer's contracts: a show_manager may read a customer's files only when
-- that customer has a contract sold at a show they manage. Scoping by
-- customer_id (not the file's nullable contract_id) matches how the readiness
-- check queries (by customer_id) and covers DLs uploaded before a contract
-- link exists.
--
-- The customer-files bucket is private and the API mints signed URLs under the
-- caller's JWT (createSignedUrl), so storage.objects RLS gates the file bytes
-- too. We mirror the grant at the storage layer. This is additive insurance:
-- if the bucket's storage policy already allows authenticated reads it is
-- simply redundant; if it is role-scoped it is required. Either way it cannot
-- restrict existing access.
--
-- Additive + idempotent. Does not touch signed contracts or existing data.
-- ---------------------------------------------------------------------------

-- ─── Table layer ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "customer_files_read_show_manager" ON public.customer_files;
CREATE POLICY "customer_files_read_show_manager" ON public.customer_files
  FOR SELECT USING (
    public.get_my_role() = 'show_manager'
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.customer_id = customer_files.customer_id
        AND c.show_id IS NOT NULL
        AND public.manages_show(c.show_id)
    )
  );

COMMENT ON POLICY "customer_files_read_show_manager" ON public.customer_files IS
  'Additive (111): show_manager reads files for customers with a contract at a show they manage. Pairs with 040 (admin/manager/bookkeeper/sales_rep/uploader). Fixes Issue 3 — DL invisible to show managers + false readiness blocker.';

-- ─── Storage layer (customer-files bucket) ──────────────────────────────────
DROP POLICY IF EXISTS "customer_files_storage_read_show_manager" ON storage.objects;
CREATE POLICY "customer_files_storage_read_show_manager" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'customer-files'
    AND public.get_my_role() = 'show_manager'
    AND EXISTS (
      SELECT 1 FROM public.customer_files cf
      JOIN public.contracts c ON c.customer_id = cf.customer_id
      WHERE cf.storage_path = storage.objects.name
        AND c.show_id IS NOT NULL
        AND public.manages_show(c.show_id)
    )
  );

-- ─── ROLLBACK (run to revert) ───────────────────────────────────────────────
/*
DROP POLICY IF EXISTS "customer_files_read_show_manager" ON public.customer_files;
DROP POLICY IF EXISTS "customer_files_storage_read_show_manager" ON storage.objects;
*/
