-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 043: Allow deposit check photo as a customer_files category
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Willie 2026-04-30: when a customer pays the deposit by check at the show,
-- the rep needs to snap a photo of the check (front side, sometimes back) so
-- the bookkeeper has the routing/account/check# captured even if the rep
-- forgets to type them. Reuses the existing customer-files vault — uploads
-- against the customer with a new category so the bookkeeper can filter to
-- just deposit-check photos when reconciling.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.customer_files DROP CONSTRAINT IF EXISTS customer_files_category_check;

ALTER TABLE public.customer_files ADD CONSTRAINT customer_files_category_check
CHECK (category IN (
  'drivers_license',
  'drivers_license_secondary',
  'proof_of_homeownership',
  'permit_receipt',
  'survey',
  'hoa_approval',
  'income_verification',
  'ach_voided_check',
  'wet_signature_contract',
  'deposit_check_photo',
  'photo',
  'other'
));

COMMENT ON COLUMN public.customer_files.category IS
  'Document type. drivers_license = primary borrower DL; drivers_license_secondary = co-borrower DL; deposit_check_photo = photo of a check used as deposit at the show floor.';
