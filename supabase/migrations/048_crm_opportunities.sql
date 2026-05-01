-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 048: CRM Opportunities
-- ═══════════════════════════════════════════════════════════════════════════
-- The pipeline record. Replaces CascadeCRM's flat 11-stage opportunities
-- with a household-attached deal that flows through configurable stages.
-- On stage='Closed Won' (or status='won'), an `opportunity` becomes a
-- `contract` (existing table); the `contract_id` FK records the link.
--
-- The legacy `leads` table stays in place. Going forward, web/Meta/Google
-- intake creates `contacts` + `opportunities`. Phase 1 will refactor the
-- /leads route; this migration is purely additive.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.opportunities (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  household_id        uuid REFERENCES public.households(id) ON DELETE SET NULL,
  primary_contact_id  uuid REFERENCES public.contacts(id)   ON DELETE SET NULL,
  pipeline_id         uuid NOT NULL REFERENCES public.pipelines(id)       ON DELETE RESTRICT,
  stage_id            uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT,
  name                text NOT NULL,
  source              text,
  source_detail       jsonb DEFAULT '{}'::jsonb, -- UTM + referrer + utm_*
  interest_category   text, -- hot_tub | swim_spa | cold_tub | accessory | service
  location_id         uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  show_id             uuid REFERENCES public.shows(id)     ON DELETE SET NULL,
  value_estimate      numeric(12,2),
  value_actual        numeric(12,2),
  probability         numeric(5,2) CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  expected_close_date date,
  owner_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','won','lost','abandoned')),
  lost_reason         text,
  lost_notes          text,
  won_at              timestamptz,
  lost_at             timestamptz,
  contract_id         uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ai_score            integer,
  ai_health           text,  -- 'green' | 'yellow' | 'red' | null
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- A 'lost' opportunity must carry a lost_reason
  CONSTRAINT opportunities_lost_reason_required
    CHECK (status <> 'lost' OR lost_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS opportunities_org_stage_status_idx ON public.opportunities(organization_id, stage_id, status);
CREATE INDEX IF NOT EXISTS opportunities_household_idx       ON public.opportunities(household_id);
CREATE INDEX IF NOT EXISTS opportunities_contact_idx         ON public.opportunities(primary_contact_id);
CREATE INDEX IF NOT EXISTS opportunities_owner_status_idx    ON public.opportunities(owner_id, status);
CREATE INDEX IF NOT EXISTS opportunities_close_date_idx      ON public.opportunities(expected_close_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS opportunities_pipeline_idx        ON public.opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS opportunities_contract_idx        ON public.opportunities(contract_id);
CREATE INDEX IF NOT EXISTS opportunities_show_idx            ON public.opportunities(show_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS opportunities_set_org_id ON public.opportunities;
CREATE TRIGGER opportunities_set_org_id BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS opportunities_updated_at ON public.opportunities;
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunities_select" ON public.opportunities;
CREATE POLICY "opportunities_select" ON public.opportunities FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "opportunities_insert" ON public.opportunities;
CREATE POLICY "opportunities_insert" ON public.opportunities FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "opportunities_update" ON public.opportunities;
CREATE POLICY "opportunities_update" ON public.opportunities FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "opportunities_delete" ON public.opportunities;
CREATE POLICY "opportunities_delete" ON public.opportunities FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

COMMENT ON TABLE public.opportunities IS
  'Pipeline records. Household-attached deals that flow through configurable stages. Contract FK on Closed Won.';
