-- Add QBO deposit account mapping to locations
-- Each location can be mapped to a specific QBO bank account
-- so deposits and payments post to the correct account in QuickBooks.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS qbo_deposit_account_id text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_account_name text;
