-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 055: CRM Forms + Submissions
-- ═══════════════════════════════════════════════════════════════════════════
-- Native form builder. Definitions live here; the public submission
-- endpoint (Phase 1) writes to `form_submissions` and creates a contact
-- via downstream logic. The submissions table has a public INSERT policy
-- (no auth required) so embedded scripts on atlasspas.com / partner sites
-- can submit. Captcha enforcement happens at the API layer (Phase 1).
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.forms (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  slug            text NOT NULL,
  name            text NOT NULL,
  description     text,
  fields          jsonb NOT NULL DEFAULT '[]'::jsonb,
                    -- array of: {key, label, type, required, options, conditional_on}
  post_submit     jsonb NOT NULL DEFAULT '{}'::jsonb,
                    -- {redirect_url, thank_you_html, cadence_id, calendly_url}
  captcha         boolean NOT NULL DEFAULT true,
  captcha_secret  text,
  is_active       boolean NOT NULL DEFAULT true,
  is_public       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id         uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id)      ON DELETE SET NULL,
  opportunity_id  uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip              text,
  user_agent      text,
  utm             jsonb DEFAULT '{}'::jsonb,
  referrer        text,
  captcha_score   numeric(3,2),
  spam_flagged    boolean NOT NULL DEFAULT false,
  captured_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forms_org_idx              ON public.forms(organization_id);
CREATE INDEX IF NOT EXISTS forms_slug_idx             ON public.forms(organization_id, slug);
CREATE INDEX IF NOT EXISTS form_submissions_form_time_idx
  ON public.form_submissions(form_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS form_submissions_contact_idx
  ON public.form_submissions(contact_id) WHERE contact_id IS NOT NULL;

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS forms_set_org_id ON public.forms;
CREATE TRIGGER forms_set_org_id BEFORE INSERT ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS forms_updated_at ON public.forms;
CREATE TRIGGER forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- form_submissions org_id is set by API code (it's a public POST, not by an authed user)

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.forms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions  ENABLE ROW LEVEL SECURITY;

-- Public can SELECT active+public form definitions (so embed scripts can render the form)
DROP POLICY IF EXISTS "forms_select_public" ON public.forms;
CREATE POLICY "forms_select_public" ON public.forms FOR SELECT USING (
  is_public = true AND is_active = true
);

DROP POLICY IF EXISTS "forms_select_authed" ON public.forms;
CREATE POLICY "forms_select_authed" ON public.forms FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "forms_insert" ON public.forms;
CREATE POLICY "forms_insert" ON public.forms FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

DROP POLICY IF EXISTS "forms_update" ON public.forms;
CREATE POLICY "forms_update" ON public.forms FOR UPDATE USING (
  auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager')) AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

-- form_submissions: anon INSERT allowed (public form submission); SELECT requires auth+org
DROP POLICY IF EXISTS "form_submissions_insert_public" ON public.form_submissions;
CREATE POLICY "form_submissions_insert_public" ON public.form_submissions FOR INSERT WITH CHECK (
  -- Caller writes form_id; org_id is set server-side from form lookup. Captcha enforced at API layer.
  true
);

DROP POLICY IF EXISTS "form_submissions_select" ON public.form_submissions;
CREATE POLICY "form_submissions_select" ON public.form_submissions FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "form_submissions_update" ON public.form_submissions;
CREATE POLICY "form_submissions_update" ON public.form_submissions FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.forms IS 'Form definitions; embeddable on partner sites.';
COMMENT ON TABLE public.form_submissions IS
  'Public-write submissions table. RLS allows anon INSERT — captcha + rate limit enforced at API layer (Phase 1).';
