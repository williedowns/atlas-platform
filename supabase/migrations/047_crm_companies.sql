-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 047: CRM Companies (B2B layer)
-- ═══════════════════════════════════════════════════════════════════════════
-- Atlas's primary motion is B2C, but referral partners (pool builders,
-- landscape architects, real estate agents), HOA bulk deals, and the future
-- Master Spas dealer network are all company-level relationships. Companies
-- have many contacts; one contact can be linked to many companies.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.companies (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'partner'
                    CHECK (type IN ('dealer','builder','hoa','real_estate','vendor','manufacturer','partner')),
  domain          text,
  website         text,
  phone           text,
  email           text,
  address         text,
  city            text,
  state           text,
  zip             text,
  notes           text,
  owner_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_contacts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES public.contacts(id)  ON DELETE CASCADE,
  role            text,
  is_primary      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, contact_id)
);

CREATE INDEX IF NOT EXISTS companies_org_type_idx       ON public.companies(organization_id, type);
CREATE INDEX IF NOT EXISTS companies_owner_idx          ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS company_contacts_company_idx ON public.company_contacts(company_id);
CREATE INDEX IF NOT EXISTS company_contacts_contact_idx ON public.company_contacts(contact_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS companies_set_org_id ON public.companies;
CREATE TRIGGER companies_set_org_id BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS company_contacts_set_org_id ON public.company_contacts;
CREATE TRIGGER company_contacts_set_org_id BEFORE INSERT ON public.company_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_contacts  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "company_contacts_select" ON public.company_contacts;
CREATE POLICY "company_contacts_select" ON public.company_contacts FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "company_contacts_insert" ON public.company_contacts;
CREATE POLICY "company_contacts_insert" ON public.company_contacts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "company_contacts_delete" ON public.company_contacts;
CREATE POLICY "company_contacts_delete" ON public.company_contacts FOR DELETE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.companies IS 'B2B layer — dealers, builders, HOAs, partners. Future Master Spas dealer network lives here.';
