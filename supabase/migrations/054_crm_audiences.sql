-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 054: CRM Audiences (Smart Lists) + Members
-- ═══════════════════════════════════════════════════════════════════════════
-- Saved segments — JSON filter trees ("all Plano-area leads who opened the
-- financing email but haven't been contacted in 5 days") plus a
-- materialized membership table (audiences x contacts) rebuilt nightly by
-- a Phase 2 Inngest job. Sync IDs allow pushing audiences to Meta Custom
-- Audiences and Google Customer Match for retargeting.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audiences (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  query           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- filter tree
  natural_language_prompt text,  -- the English query that built `query`, for re-edit
  est_size        integer,
  sync_meta_id    text,   -- Meta Custom Audience ID
  sync_google_id  text,   -- Google Customer Match list ID
  last_synced_at  timestamptz,
  last_built_at   timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  is_suppression  boolean NOT NULL DEFAULT false,  -- closed-won → suppression list
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.audience_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  audience_id     uuid NOT NULL REFERENCES public.audiences(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES public.contacts(id)  ON DELETE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audience_id, contact_id)
);

-- Now backfill the FK on campaigns.audience_id (deferred from 053)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'campaigns' AND constraint_name = 'campaigns_audience_id_fkey'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_audience_id_fkey
      FOREIGN KEY (audience_id) REFERENCES public.audiences(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audiences_org_idx                ON public.audiences(organization_id);
CREATE INDEX IF NOT EXISTS audience_members_audience_idx    ON public.audience_members(audience_id);
CREATE INDEX IF NOT EXISTS audience_members_contact_idx     ON public.audience_members(contact_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS audiences_set_org_id ON public.audiences;
CREATE TRIGGER audiences_set_org_id BEFORE INSERT ON public.audiences
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS audiences_updated_at ON public.audiences;
CREATE TRIGGER audiences_updated_at BEFORE UPDATE ON public.audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS audience_members_set_org_id ON public.audience_members;
CREATE TRIGGER audience_members_set_org_id BEFORE INSERT ON public.audience_members
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.audiences          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_members   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audiences_select" ON public.audiences;
CREATE POLICY "audiences_select" ON public.audiences FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "audiences_insert" ON public.audiences;
CREATE POLICY "audiences_insert" ON public.audiences FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "audiences_update" ON public.audiences;
CREATE POLICY "audiences_update" ON public.audiences FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "audience_members_select" ON public.audience_members;
CREATE POLICY "audience_members_select" ON public.audience_members FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "audience_members_insert" ON public.audience_members;
CREATE POLICY "audience_members_insert" ON public.audience_members FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "audience_members_delete" ON public.audience_members;
CREATE POLICY "audience_members_delete" ON public.audience_members FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.audiences IS 'Saved segments (smart lists). Sync IDs for Meta Custom Audiences + Google Customer Match.';
COMMENT ON TABLE public.audience_members IS 'Materialized audience membership. Rebuilt nightly by Phase 2 job.';
