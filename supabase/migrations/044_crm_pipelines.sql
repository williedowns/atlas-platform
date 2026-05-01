-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 044: CRM Pipelines & Stages
-- ═══════════════════════════════════════════════════════════════════════════
-- Configurable pipelines (Retail Sales, Service Estimate, Dealer Onboarding)
-- with ordered stages carrying probability + SLA. Replaces CascadeCRM's
-- 11-stage flat pipeline with clean, named pipelines per business motion.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pipelines (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'retail'
                    CHECK (type IN ('retail','service','dealer','custom')),
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id     uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  display_order   integer NOT NULL,
  probability     numeric(5,2) NOT NULL DEFAULT 0
                    CHECK (probability >= 0 AND probability <= 100),
  sla_hours       integer,
  color           text,
  is_won          boolean NOT NULL DEFAULT false,
  is_lost         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, name),
  UNIQUE (pipeline_id, display_order)
);

CREATE INDEX IF NOT EXISTS pipelines_org_idx        ON public.pipelines(organization_id);
CREATE INDEX IF NOT EXISTS pipeline_stages_pipe_idx ON public.pipeline_stages(pipeline_id, display_order);
CREATE INDEX IF NOT EXISTS pipeline_stages_org_idx  ON public.pipeline_stages(organization_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS pipelines_set_org_id ON public.pipelines;
CREATE TRIGGER pipelines_set_org_id BEFORE INSERT ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS pipelines_updated_at ON public.pipelines;
CREATE TRIGGER pipelines_updated_at BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS pipeline_stages_set_org_id ON public.pipeline_stages;
CREATE TRIGGER pipeline_stages_set_org_id BEFORE INSERT ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.pipelines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipelines_select" ON public.pipelines;
CREATE POLICY "pipelines_select" ON public.pipelines FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "pipelines_insert" ON public.pipelines;
CREATE POLICY "pipelines_insert" ON public.pipelines FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "pipelines_update" ON public.pipelines;
CREATE POLICY "pipelines_update" ON public.pipelines FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "pipeline_stages_insert" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_insert" ON public.pipeline_stages FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "pipeline_stages_update" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_update" ON public.pipeline_stages FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

-- ─── Seed Pipelines + Stages (per organization) ───────────────────────────
-- Seeds run once per org via NOT EXISTS guards. Safe to re-run.

DO $$
DECLARE
  org RECORD;
  pipe_id uuid;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP

    -- Retail Sales pipeline
    SELECT id INTO pipe_id FROM public.pipelines
      WHERE organization_id = org.id AND name = 'Retail Sales';
    IF pipe_id IS NULL THEN
      INSERT INTO public.pipelines (organization_id, name, type, description, is_default)
        VALUES (org.id, 'Retail Sales', 'retail', 'B2C hot tub / swim spa sales', true)
        RETURNING id INTO pipe_id;

      INSERT INTO public.pipeline_stages (pipeline_id, organization_id, name, display_order, probability, sla_hours, color, is_won, is_lost) VALUES
        (pipe_id, org.id, 'New Lead',          1,  5,   1,  '#94a3b8', false, false),
        (pipe_id, org.id, 'Contacted',         2, 15,   24, '#60a5fa', false, false),
        (pipe_id, org.id, 'Showroom Booked',   3, 30,   48, '#3b82f6', false, false),
        (pipe_id, org.id, 'Showroom Visited',  4, 45,   72, '#2563eb', false, false),
        (pipe_id, org.id, 'Quote Sent',        5, 60,   96, '#7c3aed', false, false),
        (pipe_id, org.id, 'Negotiation',       6, 75,   120, '#a855f7', false, false),
        (pipe_id, org.id, 'Closed Won',        7, 100,  NULL, '#22c55e', true,  false),
        (pipe_id, org.id, 'Closed Lost',       8, 0,    NULL, '#ef4444', false, true);
    END IF;

    -- Service Estimate pipeline
    SELECT id INTO pipe_id FROM public.pipelines
      WHERE organization_id = org.id AND name = 'Service Estimate';
    IF pipe_id IS NULL THEN
      INSERT INTO public.pipelines (organization_id, name, type, description)
        VALUES (org.id, 'Service Estimate', 'service', 'Service / repair quote-to-close')
        RETURNING id INTO pipe_id;

      INSERT INTO public.pipeline_stages (pipeline_id, organization_id, name, display_order, probability, sla_hours, color, is_won, is_lost) VALUES
        (pipe_id, org.id, 'Inquiry',    1, 10, 24,  '#94a3b8', false, false),
        (pipe_id, org.id, 'Diagnosed',  2, 30, 48,  '#60a5fa', false, false),
        (pipe_id, org.id, 'Quoted',     3, 50, 72,  '#7c3aed', false, false),
        (pipe_id, org.id, 'Approved',   4, 70, 24,  '#a855f7', false, false),
        (pipe_id, org.id, 'Scheduled',  5, 90, NULL,'#22c55e', false, false),
        (pipe_id, org.id, 'Closed',     6, 100, NULL,'#16a34a', true,  false);
    END IF;

    -- Dealer Onboarding pipeline
    SELECT id INTO pipe_id FROM public.pipelines
      WHERE organization_id = org.id AND name = 'Dealer Onboarding';
    IF pipe_id IS NULL THEN
      INSERT INTO public.pipelines (organization_id, name, type, description)
        VALUES (org.id, 'Dealer Onboarding', 'dealer', 'B2B dealer prospect to live')
        RETURNING id INTO pipe_id;

      INSERT INTO public.pipeline_stages (pipeline_id, organization_id, name, display_order, probability, sla_hours, color, is_won, is_lost) VALUES
        (pipe_id, org.id, 'Lead',           1, 10,  168, '#94a3b8', false, false),
        (pipe_id, org.id, 'Discovery Call', 2, 25,  168, '#60a5fa', false, false),
        (pipe_id, org.id, 'Demo',           3, 50,  336, '#7c3aed', false, false),
        (pipe_id, org.id, 'Contract Sent',  4, 75,  336, '#a855f7', false, false),
        (pipe_id, org.id, 'Live',           5, 100, NULL, '#22c55e', true,  false),
        (pipe_id, org.id, 'Lost',           6, 0,   NULL, '#ef4444', false, true);
    END IF;

  END LOOP;
END $$;

COMMENT ON TABLE public.pipelines IS 'CRM pipelines — one per business motion (retail, service, dealer, custom)';
COMMENT ON TABLE public.pipeline_stages IS 'Ordered stages within a pipeline; carries probability + SLA';
