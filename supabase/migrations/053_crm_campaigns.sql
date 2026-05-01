-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 053: CRM Campaigns
-- ═══════════════════════════════════════════════════════════════════════════
-- One-off broadcasts (email or SMS), distinct from cadences (which are
-- multi-step sequences). A campaign has an audience, content, schedule,
-- and metrics counts. Sender logic is Phase 2.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.campaigns (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  channel         text NOT NULL CHECK (channel IN ('email','sms','mms','voicemail_drop','push')),
  audience_id     uuid,  -- FK added in 054_crm_audiences.sql
  audience_query  jsonb, -- inline ad-hoc audience as alternative to saved one
  content         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {subject, body_html, body_text, from, reply_to, attachments}
  template_id     uuid,
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','scheduled','sending','sent','paused','cancelled','failed')),
  -- Metrics (denormalized counters; canonical source is *_log tables)
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count       integer NOT NULL DEFAULT 0,
  delivered_count  integer NOT NULL DEFAULT 0,
  opened_count     integer NOT NULL DEFAULT 0,
  clicked_count    integer NOT NULL DEFAULT 0,
  replied_count    integer NOT NULL DEFAULT 0,
  bounced_count    integer NOT NULL DEFAULT 0,
  unsubscribed_count integer NOT NULL DEFAULT 0,
  ab_test          jsonb,  -- {variants:[...], winner_metric, winner_id}
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_org_status_sched_idx
  ON public.campaigns(organization_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS campaigns_channel_idx ON public.campaigns(channel);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS campaigns_set_org_id ON public.campaigns;
CREATE TRIGGER campaigns_set_org_id BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
CREATE POLICY "campaigns_select" ON public.campaigns FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
CREATE POLICY "campaigns_insert" ON public.campaigns FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
CREATE POLICY "campaigns_update" ON public.campaigns FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

COMMENT ON TABLE public.campaigns IS 'One-off broadcasts (email/SMS/MMS/voicemail_drop). Send logic is Phase 2.';
