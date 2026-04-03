-- Add card brand and last4 to payments for CC reconciliation reporting
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text;
