-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 050: CRM Conversations + Messages (Unified Inbox)
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces CascadeCRM's Conversations module. One row per thread, with all
-- channel-agnostic metadata (assignee, status, AI summary/intent/sentiment).
-- Per-message rows carry channel-specific data and provider IDs (Twilio
-- SID, Resend ID) for delivery tracking. `ai_draft` stores the
-- one-click-suggested reply.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel         text NOT NULL
                    CHECK (channel IN ('sms','email','call','voicemail','internal','webchat')),
  subject         text,
  assignee_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','snoozed','closed')),
  snoozed_until   timestamptz,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  ai_summary      text,
  ai_intent       text,
  ai_sentiment    numeric(4,3),
  unread_count    integer NOT NULL DEFAULT 0,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body            text,
  html            text,
  attachments     jsonb DEFAULT '[]'::jsonb,
  provider        text,        -- twilio | resend | openphone | gmail | outlook | system
  provider_id     text,        -- e.g. twilio SMS SID, resend message id
  provider_status text,        -- queued | sent | delivered | failed | read
  error           text,
  ai_draft        jsonb,       -- one-click suggested reply payload
  sender_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_contact_idx        ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS conversations_assignee_status_idx ON public.conversations(assignee_id, status);
CREATE INDEX IF NOT EXISTS conversations_org_last_idx       ON public.conversations(organization_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS conversations_channel_idx        ON public.conversations(channel);
CREATE INDEX IF NOT EXISTS messages_conv_created_idx        ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_provider_id_idx         ON public.messages(provider, provider_id) WHERE provider_id IS NOT NULL;

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS conversations_set_org_id ON public.conversations;
CREATE TRIGGER conversations_set_org_id BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS messages_set_org_id ON public.messages;
CREATE TRIGGER messages_set_org_id BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

COMMENT ON TABLE public.conversations IS 'Threaded inbox conversations across SMS/email/call/voicemail/internal/webchat.';
COMMENT ON TABLE public.messages IS 'Individual messages within a conversation. Provider IDs (Twilio SID, Resend ID) for delivery tracking.';
