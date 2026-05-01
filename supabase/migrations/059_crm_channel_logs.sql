-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059: CRM Channel Logs (sms / email / call)
-- ═══════════════════════════════════════════════════════════════════════════
-- Per-channel delivery + analytics rows. These are the canonical source
-- for campaign metrics, complement the `messages` and `activities` tables.
--
-- Why separate per channel: each provider returns a different webhook
-- shape (Twilio status callbacks vs Resend events vs OpenPhone call
-- summaries), and analytics queries are channel-specific.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── SMS log ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sms_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id     uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  cadence_enrollment_id uuid REFERENCES public.cadence_enrollments(id) ON DELETE SET NULL,
  message_id      uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  twilio_sid      text,
  from_number     text,
  to_number       text,
  body            text,
  segments        integer,
  price_cents     integer,
  status          text,  -- queued | sent | delivered | failed | undelivered | received
  error_code      text,
  error_message   text,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Email log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id     uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  cadence_enrollment_id uuid REFERENCES public.cadence_enrollments(id) ON DELETE SET NULL,
  message_id      uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  resend_id       text,
  from_address    text,
  to_address      text,
  reply_to        text,
  subject         text,
  status          text,  -- queued | sent | delivered | bounced | complained | opened | clicked
  bounce_type     text,  -- hard | soft | block | suppressed
  opened_at       timestamptz,
  first_clicked_at timestamptz,
  click_count     integer NOT NULL DEFAULT 0,
  unsubscribed_at timestamptz,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Call log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.call_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider        text NOT NULL CHECK (provider IN ('openphone','aircall','twilio','bland','vapi','other')),
  provider_call_id text,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_number     text,
  to_number       text,
  status          text,  -- ringing | answered | missed | voicemail | completed | failed
  duration_seconds integer,
  recording_url   text,
  transcript      text,
  ai_summary      text,
  ai_sentiment    numeric(4,3),
  ai_intent       text,
  is_ai_handled   boolean NOT NULL DEFAULT false,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS sms_log_contact_time_idx   ON public.sms_log(contact_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS sms_log_campaign_idx       ON public.sms_log(campaign_id);
CREATE INDEX IF NOT EXISTS sms_log_twilio_sid_idx     ON public.sms_log(twilio_sid) WHERE twilio_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_log_org_status_idx     ON public.sms_log(organization_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS email_log_contact_time_idx ON public.email_log(contact_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_campaign_idx     ON public.email_log(campaign_id);
CREATE INDEX IF NOT EXISTS email_log_resend_id_idx    ON public.email_log(resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_log_org_status_idx   ON public.email_log(organization_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS call_log_contact_time_idx  ON public.call_log(contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS call_log_user_idx          ON public.call_log(user_id);
CREATE INDEX IF NOT EXISTS call_log_provider_id_idx   ON public.call_log(provider, provider_call_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS sms_log_set_org_id ON public.sms_log;
CREATE TRIGGER sms_log_set_org_id BEFORE INSERT ON public.sms_log
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS email_log_set_org_id ON public.email_log;
CREATE TRIGGER email_log_set_org_id BEFORE INSERT ON public.email_log
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS call_log_set_org_id ON public.call_log;
CREATE TRIGGER call_log_set_org_id BEFORE INSERT ON public.call_log
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.sms_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_log   ENABLE ROW LEVEL SECURITY;

-- SMS
DROP POLICY IF EXISTS "sms_log_select" ON public.sms_log;
CREATE POLICY "sms_log_select" ON public.sms_log FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "sms_log_insert" ON public.sms_log;
CREATE POLICY "sms_log_insert" ON public.sms_log FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "sms_log_update" ON public.sms_log;
CREATE POLICY "sms_log_update" ON public.sms_log FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

-- Email
DROP POLICY IF EXISTS "email_log_select" ON public.email_log;
CREATE POLICY "email_log_select" ON public.email_log FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "email_log_insert" ON public.email_log;
CREATE POLICY "email_log_insert" ON public.email_log FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "email_log_update" ON public.email_log;
CREATE POLICY "email_log_update" ON public.email_log FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

-- Call
DROP POLICY IF EXISTS "call_log_select" ON public.call_log;
CREATE POLICY "call_log_select" ON public.call_log FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "call_log_insert" ON public.call_log;
CREATE POLICY "call_log_insert" ON public.call_log FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "call_log_update" ON public.call_log;
CREATE POLICY "call_log_update" ON public.call_log FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.sms_log   IS 'Twilio SMS delivery + analytics log.';
COMMENT ON TABLE public.email_log IS 'Resend email delivery + open/click/bounce log.';
COMMENT ON TABLE public.call_log  IS 'OpenPhone/Aircall/Twilio Voice/Bland call log with AI transcript + summary.';
