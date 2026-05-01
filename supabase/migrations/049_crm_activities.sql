-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 049: CRM Activities (polymorphic timeline)
-- ═══════════════════════════════════════════════════════════════════════════
-- Every event on a contact / opportunity / household — calls, SMS, emails,
-- notes, tasks completed, meetings, system events, web visits, form submits.
-- This is the activity timeline shown on the contact detail page.
--
-- High write volume; expected to grow to millions of rows. Uses a BRIN
-- index on occurred_at because rows are inserted in time order and BRIN
-- is ~1000x smaller than B-tree at scale. Targeted B-tree indexes cover
-- the per-contact and per-opportunity timeline lookups.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activities (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id)      ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  household_id    uuid REFERENCES public.households(id)    ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN
                    ('call','sms','email','note','task','meeting','system','page_view','form_submit','stage_change','assignment','file_upload')),
  direction       text CHECK (direction IS NULL OR direction IN ('inbound','outbound')),
  channel         text,
  body            text,
  ai_summary      text,
  ai_sentiment    numeric(4,3),  -- -1.000 to 1.000
  duration_seconds integer,
  status          text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────

-- BRIN on append-style timestamp at scale (millions of rows)
CREATE INDEX IF NOT EXISTS activities_occurred_at_brin
  ON public.activities USING BRIN (occurred_at);

-- Per-contact / per-opportunity / per-household timelines
CREATE INDEX IF NOT EXISTS activities_contact_time_idx
  ON public.activities(contact_id, occurred_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activities_opportunity_time_idx
  ON public.activities(opportunity_id, occurred_at DESC) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activities_household_time_idx
  ON public.activities(household_id, occurred_at DESC) WHERE household_id IS NOT NULL;

-- Org-wide filter (manager dashboards)
CREATE INDEX IF NOT EXISTS activities_org_type_time_idx
  ON public.activities(organization_id, type, occurred_at DESC);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS activities_set_org_id ON public.activities;
CREATE TRIGGER activities_set_org_id BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

COMMENT ON TABLE public.activities IS
  'Polymorphic timeline of events on contacts/opportunities/households. BRIN index on occurred_at for append-scale.';
