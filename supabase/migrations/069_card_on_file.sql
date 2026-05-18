-- Card-on-file (COF) for charging the contract balance at delivery against the
-- same card the customer used for the deposit. Visa/Mastercard network rules
-- require explicit customer authorization to store a card for reuse, so we
-- persist the consent metadata (amount displayed at consent, IP, timestamp)
-- alongside the reusable identifier so chargeback disputes have a defensible
-- audit trail.
--
-- One saved card per contract — scope decision for Phase 1. If multi-card per
-- customer is needed later, migrate to a dedicated `customer_cards` table.
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS saved_card_token text,         -- Intuit reusable identifier (card.id from /charges)
  ADD COLUMN IF NOT EXISTS saved_card_brand text,          -- "Visa", "MasterCard", "AmericanExpress", etc.
  ADD COLUMN IF NOT EXISTS saved_card_last4 text,          -- last 4 of PAN for display
  ADD COLUMN IF NOT EXISTS saved_card_exp_month smallint,  -- 1-12
  ADD COLUMN IF NOT EXISTS saved_card_exp_year smallint,   -- 4-digit
  ADD COLUMN IF NOT EXISTS saved_card_consent_at timestamptz,  -- when customer opted in
  ADD COLUMN IF NOT EXISTS saved_card_consent_ip text,         -- IP at consent time
  ADD COLUMN IF NOT EXISTS saved_card_consent_amount numeric;  -- balance amount shown when consenting
