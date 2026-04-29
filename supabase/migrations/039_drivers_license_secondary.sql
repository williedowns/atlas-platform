-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 039: Drivers License — Secondary Borrower category
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Per Willie 04-29: financing requires a DL for BOTH borrowers (primary AND
-- secondary) when a co-borrower is on the loan. Existing 'drivers_license'
-- category continues to mean "primary DL"; new 'drivers_license_secondary'
-- holds the co-borrower's DL.

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
  'photo',
  'other'
));

COMMENT ON COLUMN public.customer_files.category IS
  'Document type. drivers_license = primary borrower DL; drivers_license_secondary = co-borrower DL.';
