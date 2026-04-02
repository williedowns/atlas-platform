-- Add 'quote' to the contracts status check constraint
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (status IN (
    'quote',
    'draft',
    'pending_signature',
    'signed',
    'deposit_collected',
    'in_production',
    'ready_for_delivery',
    'delivered',
    'cancelled'
  ));
