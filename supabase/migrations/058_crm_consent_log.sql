-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 058: CRM Consent Log
-- ═══════════════════════════════════════════════════════════════════════════
-- Append-only TCPA / GDPR consent history per channel per contact.
-- This is the legal record for who-said-yes-to-what-and-when. Required
-- for 10DLC compliance, CAN-SPAM, GDPR, and CASL. Never updated — new
-- row per consent change.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.consent_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email','sms','mms','call','voicemail','postal')),
  status          text NOT NULL CHECK (status IN ('opted_in','opted_out','double_opt_in_pending','double_opt_in_confirmed','blocked','expired')),
  source          text,  -- web_form | sms_keyword | email_unsubscribe | manual | import | api
  source_detail   jsonb DEFAULT '{}'::jsonb,
  ip              text,
  user_agent      text,
  legal_basis     text,  -- consent | legitimate_interest | contract | legal_obligation
  notes           text,
  captured_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_log_contact_channel_idx
  ON public.consent_log(contact_id, channel, captured_at DESC);
CREATE INDEX IF NOT EXISTS consent_log_org_captured_idx
  ON public.consent_log(organization_id, captured_at DESC);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS consent_log_set_org_id ON public.consent_log;
CREATE TRIGGER consent_log_set_org_id BEFORE INSERT ON public.consent_log
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consent_log_select" ON public.consent_log;
CREATE POLICY "consent_log_select" ON public.consent_log FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "consent_log_insert" ON public.consent_log;
CREATE POLICY "consent_log_insert" ON public.consent_log FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- INTENTIONALLY no UPDATE / DELETE policies. Append-only. Admins can use
-- the service role to fix mistakes; non-admins cannot mutate this log.

COMMENT ON TABLE public.consent_log IS
  'Append-only TCPA/GDPR consent history. Legal record. Never updated — new row per consent change.';
