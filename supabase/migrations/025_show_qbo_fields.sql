-- Add QBO deposit account and Location (Department) mapping to shows
-- Mirrors the same fields on locations so expo/show sales post to the right QBO accounts
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS qbo_deposit_account_id   text,
  ADD COLUMN IF NOT EXISTS qbo_deposit_account_name text,
  ADD COLUMN IF NOT EXISTS qbo_department_id        text,
  ADD COLUMN IF NOT EXISTS qbo_department_name      text;
