-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 051: CRM Tasks
-- ═══════════════════════════════════════════════════════════════════════════
-- First-class user-assigned work — calls, follow-up emails, custom tasks.
-- Tasks live on a contact OR opportunity (or both) and roll up to a rep's
-- "Today's Plays" home view. The `source` column distinguishes manual,
-- cadence-step-generated, and AI-suggested tasks for analytics.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id)      ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('call','sms','email','follow_up','meeting','custom')),
  title           text NOT NULL,
  description     text,
  due_at          timestamptz,
  priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),
  assignee_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source          text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual','cadence','ai','system')),
  source_ref_id   uuid,  -- e.g. cadence_enrollment id when source='cadence'
  completed_at    timestamptz,
  completed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  result          text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Active queue per assignee (the most-hit query): partial index keeps it tiny
CREATE INDEX IF NOT EXISTS tasks_assignee_due_active_idx
  ON public.tasks(assignee_id, due_at) WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_contact_idx     ON public.tasks(contact_id);
CREATE INDEX IF NOT EXISTS tasks_opportunity_idx ON public.tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS tasks_org_status_due_idx
  ON public.tasks(organization_id, due_at) WHERE completed_at IS NULL;

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tasks_set_org_id ON public.tasks;
CREATE TRIGGER tasks_set_org_id BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  ) AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  )
);

COMMENT ON TABLE public.tasks IS 'Tasks (first-class). Source distinguishes manual / cadence-step / AI-suggested for analytics.';
