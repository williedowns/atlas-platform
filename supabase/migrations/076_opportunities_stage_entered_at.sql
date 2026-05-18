-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 063: opportunities.stage_entered_at
-- ═══════════════════════════════════════════════════════════════════════════
-- The forecast "deals at risk" calculation needs accurate "time in current
-- stage" data. Today it uses opportunities.updated_at as a proxy, which
-- gets reset by ANY edit (e.g. fixing a typo on the deal name resets the
-- at-risk clock). That's wrong.
--
-- This adds a dedicated `stage_entered_at` column, updated only when the
-- stage actually changes. Backfills existing rows to `updated_at` as a
-- best-effort starting point.
--
-- moveOpportunityStage (server action) will set this on every stage change
-- going forward.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'stage_entered_at'
  ) THEN
    ALTER TABLE public.opportunities
      ADD COLUMN stage_entered_at timestamptz;

    -- Backfill: use updated_at as the best available proxy for existing rows.
    -- New rows created after this migration will set stage_entered_at = now()
    -- at insert time via the application layer.
    UPDATE public.opportunities
      SET stage_entered_at = COALESCE(updated_at, created_at, now())
      WHERE stage_entered_at IS NULL;

    -- Default for any future rows that don't explicitly set it
    ALTER TABLE public.opportunities
      ALTER COLUMN stage_entered_at SET DEFAULT now();

    -- Make it NOT NULL once backfill is complete
    ALTER TABLE public.opportunities
      ALTER COLUMN stage_entered_at SET NOT NULL;
  END IF;
END $$;

-- Index for the forecast "at risk" query: open opps sorted by stage age
CREATE INDEX IF NOT EXISTS opportunities_stage_entered_at_idx
  ON public.opportunities(stage_entered_at)
  WHERE status = 'open';

COMMENT ON COLUMN public.opportunities.stage_entered_at IS
  'When the opportunity entered its current stage. Used for "time in stage" / "at risk" calculations. Updated by moveOpportunityStage server action on every stage change. Does NOT change on other edits (unlike updated_at).';
