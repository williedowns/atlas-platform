-- ============================================================================
-- Inventory "Sync from Google Sheet" support
--   1. Partial unique index for on-order units (no serial yet) — idempotent.
--   2. inventory_sync_state: records last sync time + summary for the UI.
--   3. upsert_inventory_units(rows jsonb, p_org_id uuid): set-based upsert that
--      mirrors the proven gen_inventory_sync.py ON CONFLICT logic and now also
--      OWNS show_id (resolved upstream). COALESCE on model/shell/cabinet/wrap/
--      received_date preserves existing values when the sheet cell is blank.
-- ============================================================================

-- 1. On-order conflict target (matches the generated sync SQL) ----------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_units_order_number_unique
  ON public.inventory_units(order_number)
  WHERE serial_number IS NULL;

-- 2. Sync state ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_sync_state (
  id            text PRIMARY KEY,
  last_synced_at timestamptz,
  last_summary  jsonb,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.inventory_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_state readable by authenticated" ON public.inventory_sync_state;
CREATE POLICY "sync_state readable by authenticated"
  ON public.inventory_sync_state FOR SELECT
  TO authenticated USING (true);
-- Writes happen only through the service-role client in the sync route.

-- 3. Upsert RPC ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_inventory_units(rows jsonb, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ser_ins int := 0;
  v_ser_upd int := 0;
  v_ord_ins int := 0;
  v_ord_upd int := 0;
BEGIN
  -- Serialized units ---------------------------------------------------------
  WITH d AS (
    SELECT * FROM jsonb_to_recordset(rows) AS x(
      serial_number text, order_number text, location_name text, status text,
      model_code text, shell_color text, cabinet_color text, wrap_status text,
      customer_name text, fin_balance text, received_date date, notes text,
      show_id uuid
    )
  ),
  up AS (
    INSERT INTO public.inventory_units AS iu (
      serial_number, location_id, show_id, status, model_code, shell_color,
      cabinet_color, wrap_status, customer_name, fin_balance, received_date,
      notes, organization_id
    )
    SELECT d.serial_number,
           (SELECT id FROM public.locations WHERE name = d.location_name LIMIT 1),
           d.show_id, d.status, d.model_code, d.shell_color, d.cabinet_color,
           d.wrap_status, d.customer_name, d.fin_balance, d.received_date,
           d.notes, p_org_id
    FROM d
    WHERE d.serial_number IS NOT NULL
    ON CONFLICT (serial_number) DO UPDATE SET
      location_id   = EXCLUDED.location_id,
      show_id       = EXCLUDED.show_id,
      status        = EXCLUDED.status,
      model_code    = COALESCE(EXCLUDED.model_code, iu.model_code),
      shell_color   = COALESCE(EXCLUDED.shell_color, iu.shell_color),
      cabinet_color = COALESCE(EXCLUDED.cabinet_color, iu.cabinet_color),
      wrap_status   = COALESCE(EXCLUDED.wrap_status, iu.wrap_status),
      customer_name = EXCLUDED.customer_name,
      fin_balance   = EXCLUDED.fin_balance,
      received_date = COALESCE(EXCLUDED.received_date, iu.received_date),
      notes         = EXCLUDED.notes,
      updated_at    = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE inserted), count(*) FILTER (WHERE NOT inserted)
    INTO v_ser_ins, v_ser_upd FROM up;

  -- On-order units (no serial) -----------------------------------------------
  WITH d AS (
    SELECT * FROM jsonb_to_recordset(rows) AS x(
      serial_number text, order_number text, location_name text, status text,
      model_code text, shell_color text, cabinet_color text, wrap_status text,
      customer_name text, fin_balance text, received_date date, notes text,
      show_id uuid
    )
  ),
  up AS (
    INSERT INTO public.inventory_units AS iu (
      order_number, location_id, show_id, status, model_code, shell_color,
      cabinet_color, wrap_status, customer_name, fin_balance, received_date,
      notes, organization_id
    )
    SELECT d.order_number,
           (SELECT id FROM public.locations WHERE name = d.location_name LIMIT 1),
           d.show_id, d.status, d.model_code, d.shell_color, d.cabinet_color,
           d.wrap_status, d.customer_name, d.fin_balance, d.received_date,
           d.notes, p_org_id
    FROM d
    WHERE d.serial_number IS NULL AND d.order_number IS NOT NULL
    ON CONFLICT (order_number) WHERE serial_number IS NULL DO UPDATE SET
      location_id   = EXCLUDED.location_id,
      show_id       = EXCLUDED.show_id,
      status        = EXCLUDED.status,
      model_code    = COALESCE(EXCLUDED.model_code, iu.model_code),
      shell_color   = COALESCE(EXCLUDED.shell_color, iu.shell_color),
      cabinet_color = COALESCE(EXCLUDED.cabinet_color, iu.cabinet_color),
      wrap_status   = COALESCE(EXCLUDED.wrap_status, iu.wrap_status),
      customer_name = EXCLUDED.customer_name,
      fin_balance   = EXCLUDED.fin_balance,
      received_date = COALESCE(EXCLUDED.received_date, iu.received_date),
      notes         = EXCLUDED.notes,
      updated_at    = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE inserted), count(*) FILTER (WHERE NOT inserted)
    INTO v_ord_ins, v_ord_upd FROM up;

  RETURN jsonb_build_object(
    'inserted', v_ser_ins + v_ord_ins,
    'updated',  v_ser_upd + v_ord_upd,
    'serial_inserted', v_ser_ins, 'serial_updated', v_ser_upd,
    'order_inserted',  v_ord_ins, 'order_updated',  v_ord_upd
  );
END;
$$;

-- SECURITY DEFINER functions are granted EXECUTE to PUBLIC by default; lock this
-- privileged bulk-write down to the service-role client used by the sync route.
REVOKE EXECUTE ON FUNCTION public.upsert_inventory_units(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_inventory_units(jsonb, uuid) TO service_role;
