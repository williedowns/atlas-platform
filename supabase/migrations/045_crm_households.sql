-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 045: CRM Households
-- ═══════════════════════════════════════════════════════════════════════════
-- The "household" is the unit of revenue for hot tub / swim spa sales — a
-- joint-decision unit (typically a couple, family, or HOA). Contacts and
-- opportunities attach to a household, so both spouses see the same deal.
-- This concept doesn't exist in the legacy `customers` table.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.households (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  household_type      text NOT NULL DEFAULT 'residential'
                        CHECK (household_type IN ('residential','commercial','hoa','referral')),
  lifecycle_stage     text NOT NULL DEFAULT 'lead'
                        CHECK (lifecycle_stage IN ('lead','mql','sql','customer','inactive')),
  primary_address     text,
  city                text,
  state               text,
  zip                 text,
  source              text,
  source_detail       jsonb DEFAULT '{}'::jsonb,
  score               integer NOT NULL DEFAULT 0,
  owner_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  primary_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  marketing_eligible  boolean NOT NULL DEFAULT true,
  last_activity_at    timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS households_org_activity_idx ON public.households(organization_id, last_activity_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS households_owner_idx        ON public.households(owner_id);
CREATE INDEX IF NOT EXISTS households_lifecycle_idx    ON public.households(organization_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS households_zip_idx          ON public.households(zip);
CREATE INDEX IF NOT EXISTS households_location_idx     ON public.households(primary_location_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS households_set_org_id ON public.households;
CREATE TRIGGER households_set_org_id BEFORE INSERT ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS households_updated_at ON public.households;
CREATE TRIGGER households_updated_at BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "households_select" ON public.households;
CREATE POLICY "households_select" ON public.households FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "households_insert" ON public.households;
CREATE POLICY "households_insert" ON public.households FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "households_update" ON public.households;
CREATE POLICY "households_update" ON public.households FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "households_delete" ON public.households;
CREATE POLICY "households_delete" ON public.households FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

COMMENT ON TABLE public.households IS 'Joint-decision unit (household). Contacts and opportunities attach here.';
