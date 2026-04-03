-- Add delivery_diagram JSONB column to contracts table.
-- Stores the customer's selected delivery scenario and any fill-in measurements.
-- Shape: { scenario_id: number, label: string, fields: Record<string, string> }

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS delivery_diagram JSONB;
