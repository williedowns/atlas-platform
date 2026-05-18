-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 062: Enable Supabase Realtime for CRM tables
-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase Realtime broadcasts row changes (INSERT/UPDATE/DELETE) to
-- connected clients via WebSocket, but each table must be explicitly added
-- to the `supabase_realtime` publication. RLS is respected on the broadcast
-- side — each subscribed client only receives changes for rows they can
-- read.
--
-- This migration adds:
--   - opportunities (so Kanban updates live across reps)
--   - activities   (so timelines update live)
--   - tasks        (so "Today's Plays" updates live)
--
-- Idempotent: re-running is safe (checks publication membership first).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
  realtime_tables text[] := ARRAY['opportunities', 'activities', 'tasks'];
BEGIN
  FOREACH t IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added public.% to supabase_realtime publication', t;
    ELSE
      RAISE NOTICE 'Skipped public.% — already in supabase_realtime publication', t;
    END IF;
  END LOOP;
END $$;
