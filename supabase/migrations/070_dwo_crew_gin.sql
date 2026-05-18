-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 070: GIN index on delivery_work_orders.assigned_crew_ids
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The conflict-detection helper (lib/work-order-conflicts.ts) runs an
-- `assigned_crew_ids && ARRAY[...]` overlap check on every work-order save.
-- Without a GIN index on the uuid[] column, Postgres falls back to a sequential
-- scan — fine at today's scale, but unbounded as deliveries grow.
--
-- Partial index: we only care about open work orders for conflict purposes.

CREATE INDEX IF NOT EXISTS dwo_crew_gin
  ON public.delivery_work_orders
  USING GIN (assigned_crew_ids)
  WHERE status IN ('scheduled', 'in_progress');

COMMENT ON INDEX public.dwo_crew_gin IS
  'Speeds up crew-overlap conflict checks on lib/work-order-conflicts.detectCrewConflicts.';
