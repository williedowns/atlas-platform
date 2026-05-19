-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 061: Replace Retail Sales stages with CascadeCRM's 11 stages
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 044 seeded an 8-stage clean retail pipeline (New Lead → Closed
-- Won/Lost). Per Willie, the sales team is already trained on CascadeCRM's
-- 11-stage "Sales" pipeline; matching it removes retraining cost. The plan
-- doc previously recommended pruning to ~8 stages, but adoption beats
-- stage hygiene — we'll mirror Cascade exactly and prune later if reps
-- agree some stages are dead.
--
-- Source: CascadeCRM Opportunities Kanban screenshots from
-- /CRM/Existing CRM files for reference/Screenshot 2026-04-29 at 12.48.20-49.06 PM.png
--
-- This migration is SAFE because pipeline_stages → opportunities uses
-- ON DELETE RESTRICT (migration 048). If any opportunities exist on the
-- old stages, the DELETE will fail with a clear FK-violation error, and
-- we'll need a separate stage-remap migration. As of 2026-05-01, opps
-- count is 0, so this runs cleanly.
--
-- Idempotent — checks current stage names, only re-seeds if they don't
-- already match the new set.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org RECORD;
  pipe_id uuid;
  current_count integer;
  matching_count integer;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP

    SELECT id INTO pipe_id
    FROM public.pipelines
    WHERE organization_id = org.id AND name = 'Retail Sales';

    -- Org doesn't have a Retail Sales pipeline yet; skip (mig 044 didn't run for it)
    CONTINUE WHEN pipe_id IS NULL;

    -- Count how many of the existing stages already match the new Cascade set.
    -- If all 11 names are present, this migration has already applied — skip.
    SELECT COUNT(*) INTO matching_count
    FROM public.pipeline_stages
    WHERE pipeline_id = pipe_id
      AND name IN (
        'New Lead','Shark Tank','Called','Interested','Scheduled',
        'Send to Method','Quote Sent','Purchased','Nurture',
        'Bad Number','Lost Opportunity'
      );

    SELECT COUNT(*) INTO current_count
    FROM public.pipeline_stages
    WHERE pipeline_id = pipe_id;

    IF matching_count = 11 AND current_count = 11 THEN
      -- Already migrated for this org
      CONTINUE;
    END IF;

    -- Replace stages. ON DELETE RESTRICT on opportunities.stage_id will
    -- protect us if anyone has already created opportunities — the DELETE
    -- will fail loudly. As of 2026-05-01 there are 0 opportunities.
    DELETE FROM public.pipeline_stages WHERE pipeline_id = pipe_id;

    INSERT INTO public.pipeline_stages
      (pipeline_id, organization_id, name, display_order, probability, sla_hours, color, is_won, is_lost)
    VALUES
      (pipe_id, org.id, 'New Lead',          1, 5,   1,    '#94a3b8', false, false),
      (pipe_id, org.id, 'Shark Tank',        2, 2,   336,  '#64748b', false, false),
      (pipe_id, org.id, 'Called',            3, 15,  24,   '#60a5fa', false, false),
      (pipe_id, org.id, 'Interested',        4, 30,  48,   '#6366f1', false, false),
      (pipe_id, org.id, 'Scheduled',         5, 50,  72,   '#4f46e5', false, false),
      (pipe_id, org.id, 'Send to Method',    6, 70,  48,   '#7c3aed', false, false),
      (pipe_id, org.id, 'Quote Sent',        7, 80,  96,   '#a855f7', false, false),
      (pipe_id, org.id, 'Purchased',         8, 100, NULL, '#22c55e', true,  false),
      (pipe_id, org.id, 'Nurture',           9, 10,  720,  '#f59e0b', false, false),
      (pipe_id, org.id, 'Bad Number',       10, 0,   NULL, '#ef4444', false, true),
      (pipe_id, org.id, 'Lost Opportunity', 11, 0,   NULL, '#b91c1c', false, true);

  END LOOP;
END $$;

COMMENT ON TABLE public.pipeline_stages IS
  'Ordered stages within a pipeline; carries probability + SLA. Retail Sales mirrors CascadeCRM''s 11 stages for sales-team adoption.';
