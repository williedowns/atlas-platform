-- Atlas Spas Platform — Migration 015: CRM Leads
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id       uuid REFERENCES public.shows(id) ON DELETE SET NULL,
  assigned_to   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name    text NOT NULL,
  last_name     text,
  phone         text,
  email         text,
  interest      text,  -- product / category they're interested in
  status        text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','hot','converted','lost')),
  notes         text,
  converted_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX leads_show_id_idx        ON public.leads(show_id);
CREATE INDEX leads_assigned_to_idx    ON public.leads(assigned_to);
CREATE INDEX leads_status_idx         ON public.leads(status);
CREATE INDEX leads_created_at_idx     ON public.leads(created_at DESC);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Reps can see leads assigned to them; admins/managers see all
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

-- Any authenticated user can create a lead
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reps can update their own leads; admins/managers can update any
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );
