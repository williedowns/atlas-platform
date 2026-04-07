-- Add QBO Location (Department) ID to locations table
-- DepartmentRef on invoices allocates revenue/tax to the correct location in QBO reports
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS qbo_department_id text,
  ADD COLUMN IF NOT EXISTS qbo_department_name text;
