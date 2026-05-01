-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 052: CRM Cadences + Enrollments (Multi-Step Play Engine)
-- ═══════════════════════════════════════════════════════════════════════════
-- A cadence is a reusable multi-step "play" — chaining SMS, email, voice,
-- audience adds, tasks, and manager escalations. Steps stored as an
-- ordered jsonb array.
--
-- A cadence_enrollment is one contact running through one cadence. The
-- executor (Phase 2 Inngest job) polls for `status='active' AND
-- next_step_at <= now()` — the partial index makes that scan trivial.
--
-- Phase 0 defines schema only. Step execution is Phase 2.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cadences (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  steps           jsonb NOT NULL DEFAULT '[]'::jsonb,
                    -- array of: {wait_amount, wait_unit, channel, action, template_id, condition, skip_if}
  audience_query  jsonb,  -- optional default audience this cadence targets
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cadence_id      uuid NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  current_step    integer NOT NULL DEFAULT 0,
  next_step_at    timestamptz,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','completed','exited')),
  exit_reason     text,
  enrolled_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  last_step_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cadences_org_idx              ON public.cadences(organization_id);
CREATE INDEX IF NOT EXISTS cadence_enrollments_due_idx
  ON public.cadence_enrollments(next_step_at)
  WHERE status = 'active' AND next_step_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS cadence_enrollments_contact_idx ON public.cadence_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS cadence_enrollments_cadence_idx ON public.cadence_enrollments(cadence_id);

-- A contact can only be in ONE ACTIVE enrollment per cadence at a time.
-- Partial unique index: only enforces uniqueness for status='active' rows,
-- so historical completed/exited enrollments accumulate freely (and a
-- contact can be re-enrolled after their previous run finishes).
CREATE UNIQUE INDEX IF NOT EXISTS cadence_enrollments_active_unique_idx
  ON public.cadence_enrollments (cadence_id, contact_id)
  WHERE status = 'active';

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS cadences_set_org_id ON public.cadences;
CREATE TRIGGER cadences_set_org_id BEFORE INSERT ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS cadences_updated_at ON public.cadences;
CREATE TRIGGER cadences_updated_at BEFORE UPDATE ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS cadence_enrollments_set_org_id ON public.cadence_enrollments;
CREATE TRIGGER cadence_enrollments_set_org_id BEFORE INSERT ON public.cadence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS cadence_enrollments_updated_at ON public.cadence_enrollments;
CREATE TRIGGER cadence_enrollments_updated_at BEFORE UPDATE ON public.cadence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.cadences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cadences_select" ON public.cadences;
CREATE POLICY "cadences_select" ON public.cadences FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "cadences_insert" ON public.cadences;
CREATE POLICY "cadences_insert" ON public.cadences FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

DROP POLICY IF EXISTS "cadences_update" ON public.cadences;
CREATE POLICY "cadences_update" ON public.cadences FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

DROP POLICY IF EXISTS "cadence_enrollments_select" ON public.cadence_enrollments;
CREATE POLICY "cadence_enrollments_select" ON public.cadence_enrollments FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "cadence_enrollments_insert" ON public.cadence_enrollments;
CREATE POLICY "cadence_enrollments_insert" ON public.cadence_enrollments FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "cadence_enrollments_update" ON public.cadence_enrollments;
CREATE POLICY "cadence_enrollments_update" ON public.cadence_enrollments FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.cadences IS 'Multi-step play templates (reusable). Steps in jsonb. Executor is Phase 2.';
COMMENT ON TABLE public.cadence_enrollments IS 'A contact running through a cadence. Partial index on next_step_at for executor poll.';
