-- ── 071_show_deal_overrides.sql ───────────────────────────────────────────
-- Per-contract spreadsheet-side annotations for show-sales workbooks.
--
-- A contract captures the legal/financial deal (customer, line items, total,
-- payments). The show-sales workbook captures additional hand-entered context
-- a show manager / Lori adds while reconciling the show — multi-rep splits,
-- spiffs, marketing feedback, freight/crane/removal costs, etc.
--
-- This table holds one optional row per contract. Lazily created on first
-- edit; absent rows mean "no overrides — show contract data as-is".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.show_deal_overrides (
  contract_id uuid PRIMARY KEY REFERENCES public.contracts(id) ON DELETE CASCADE,

  -- Row-level status / day overrides
  status_override text,                       -- 'OK','Cancelled','Low Deposit','Contingent','Financing Pending'
  day_of_week text,                           -- 'Fri','Sat','Sun' — override the auto-derived weekday

  -- Multi-rep splits (contracts schema only stores one sales_rep_id)
  salesman_2 text,
  salesman_3 text,
  salesman_4 text,

  -- Spa identification beyond what's in line_items
  color text,
  color_cost numeric(10,2),
  cabinet text,
  cabinet_cost numeric(10,2),
  serial_number text,

  -- Add-on options + costs
  masterpur text,                             -- 'YES'/'NO'
  masterpur_cost numeric(10,2),
  floor_system text,                          -- 'YES'/'NO'
  floor_system_cost numeric(10,2),
  other_options_1 text,
  other_options_1_cost numeric(10,2),
  other_options_2 text,
  other_options_2_cost numeric(10,2),
  other_spa_costs numeric(10,2),

  step text,                                  -- 'YES'/'NO'
  freight_cost numeric(10,2),
  delivery_cost numeric(10,2),
  crane_cost numeric(10,2),
  removal_cost numeric(10,2),
  cover_lift_type text,
  cover_lift_count integer,

  -- Commission overrides + spiffs
  override_reason text,
  commission_rate numeric(6,4),
  spiff_reason text,
  spiff_amount numeric(10,2),
  spiff_payable text,                         -- 'YES'/'NO'

  -- Financing extras (contracts.financing JSONB holds the primary record;
  -- these are workbook-only fields Lori tracks alongside)
  plan_number text,
  financing_cost numeric(10,2),

  approx_delivery_date text,
  marketing_feedback text,
  comments text,

  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Auto-bump updated_at on every change
CREATE OR REPLACE FUNCTION public.touch_show_deal_overrides()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_show_deal_overrides ON public.show_deal_overrides;
CREATE TRIGGER trg_touch_show_deal_overrides
  BEFORE UPDATE ON public.show_deal_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_show_deal_overrides();

-- RLS: same org-scoping pattern as contracts — admins/managers/bookkeepers
-- read anything in their org; reps can read/write rows for their own contracts.
ALTER TABLE public.show_deal_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "show_deal_overrides_read" ON public.show_deal_overrides;
CREATE POLICY "show_deal_overrides_read" ON public.show_deal_overrides FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.profiles me ON me.id = auth.uid()
    WHERE c.id = show_deal_overrides.contract_id
      AND (
        me.role = 'admin'
        OR (me.role IN ('manager','bookkeeper') AND c.organization_id = public.get_my_org_id())
        OR c.sales_rep_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "show_deal_overrides_write" ON public.show_deal_overrides;
CREATE POLICY "show_deal_overrides_write" ON public.show_deal_overrides
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE c.id = show_deal_overrides.contract_id
        AND (
          me.role IN ('admin','manager')
          OR (me.role = 'bookkeeper' AND c.organization_id = public.get_my_org_id())
        )
    )
  );

DROP POLICY IF EXISTS "show_deal_overrides_update" ON public.show_deal_overrides;
CREATE POLICY "show_deal_overrides_update" ON public.show_deal_overrides
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE c.id = show_deal_overrides.contract_id
        AND (
          me.role IN ('admin','manager')
          OR (me.role = 'bookkeeper' AND c.organization_id = public.get_my_org_id())
        )
    )
  );
