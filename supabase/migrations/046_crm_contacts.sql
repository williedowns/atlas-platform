-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 046: CRM Contacts + Identifiers
-- ═══════════════════════════════════════════════════════════════════════════
-- The new canonical CRM person record. Goes BEYOND the legacy `customers`
-- table — adds household linkage, multi-email/phone history, per-channel
-- consent + DND, owner, score, and the source/source_detail attribution
-- needed for marketing.
--
-- `customer_id` is an OPTIONAL FK back to the legacy customers table so
-- reps can navigate from a CRM contact to their existing contracts/files.
-- Going forward, NEW leads land in `contacts` only. Old `customers` rows
-- stay queryable; a Phase 1 backfill can mirror them into contacts later.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- pg_trgm enables trigram-based ILIKE search on email/phone/name (Cmd-K)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.contacts (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  household_id        uuid REFERENCES public.households(id) ON DELETE SET NULL,
  customer_id         uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  role_in_household   text CHECK (role_in_household IN ('primary','partner','child','other')),
  first_name          text NOT NULL,
  last_name           text,
  email_primary       text,
  phone_primary       text,
  emails              text[] NOT NULL DEFAULT '{}',
  phones              text[] NOT NULL DEFAULT '{}',
  dob                 date,
  address             text,
  city                text,
  state               text,
  zip                 text,
  channels_consent    jsonb NOT NULL DEFAULT '{}'::jsonb,
  do_not_contact      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source              text,
  source_detail       jsonb DEFAULT '{}'::jsonb,
  score               integer NOT NULL DEFAULT 0,
  owner_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_activity_at    timestamptz,
  unsubscribed_at     timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── Identity history (multiple emails / phones over time per contact) ────
CREATE TABLE IF NOT EXISTS public.contact_identifiers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('email','phone','external')),
  value           text NOT NULL,
  is_primary      boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, value)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS contacts_org_owner_idx     ON public.contacts(organization_id, owner_id);
CREATE INDEX IF NOT EXISTS contacts_org_activity_idx  ON public.contacts(organization_id, last_activity_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS contacts_household_idx     ON public.contacts(household_id);
CREATE INDEX IF NOT EXISTS contacts_customer_idx      ON public.contacts(customer_id);

-- Trigram indexes for fuzzy search (Cmd-K palette + smart-list filters)
CREATE INDEX IF NOT EXISTS contacts_email_trgm_idx ON public.contacts
  USING gin (lower(email_primary) gin_trgm_ops) WHERE email_primary IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_phone_trgm_idx ON public.contacts
  USING gin (phone_primary gin_trgm_ops) WHERE phone_primary IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_name_trgm_idx ON public.contacts
  USING gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- Prevent duplicate contacts within an org by primary email
CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_email_unique_idx
  ON public.contacts (organization_id, lower(email_primary))
  WHERE email_primary IS NOT NULL;

CREATE INDEX IF NOT EXISTS contact_identifiers_contact_idx
  ON public.contact_identifiers(contact_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS contacts_set_org_id ON public.contacts;
CREATE TRIGGER contacts_set_org_id BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS contact_identifiers_set_org_id ON public.contact_identifiers;
CREATE TRIGGER contact_identifiers_set_org_id BEFORE INSERT ON public.contact_identifiers
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_identifiers  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

DROP POLICY IF EXISTS "contact_identifiers_select" ON public.contact_identifiers;
CREATE POLICY "contact_identifiers_select" ON public.contact_identifiers FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "contact_identifiers_insert" ON public.contact_identifiers;
CREATE POLICY "contact_identifiers_insert" ON public.contact_identifiers FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "contact_identifiers_update" ON public.contact_identifiers;
CREATE POLICY "contact_identifiers_update" ON public.contact_identifiers FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.contacts IS
  'Canonical CRM person record. Replaces the legacy customers table for new leads going forward; customer_id FK preserves history for purchased customers.';
COMMENT ON TABLE public.contact_identifiers IS
  'Identity history — multiple emails/phones per contact over time. Used for dedupe matching during CascadeCRM migration and inbound lead matching.';
