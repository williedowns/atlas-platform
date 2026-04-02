-- Make location_id and show_id nullable on contracts
-- Show-based sales use show_id for location context; no linked locations row required.
-- Store sales use location_id only; show_id is null.

ALTER TABLE public.contracts
  ALTER COLUMN location_id DROP NOT NULL;

ALTER TABLE public.contracts
  ALTER COLUMN show_id DROP NOT NULL;
