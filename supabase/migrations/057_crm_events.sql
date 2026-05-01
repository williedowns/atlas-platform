-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 057: CRM Behavioral Events
-- ═══════════════════════════════════════════════════════════════════════════
-- Append-only event log: page views, email opens, link clicks, video
-- watches, deal-room visits. Distinct from `activities` (which is the
-- user-facing timeline of meaningful interactions). Events are raw
-- telemetry powering scoring, attribution, and behavior-triggered cadences.
--
-- Volume is HIGH — at scale, millions of rows. BRIN on occurred_at;
-- targeted B-tree for per-contact and per-type lookups.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  type            text NOT NULL,
                    -- e.g. page_view, email_open, email_click, sms_click,
                    -- form_submit, video_play, deal_room_visit, ad_view
  source          text,  -- web | email | sms | ad | system
  properties      jsonb DEFAULT '{}'::jsonb,
                    -- {url, utm, deal_room_id, message_id, link, duration, ...}
  session_id      text,
  ip              text,
  user_agent      text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_occurred_at_brin
  ON public.events USING BRIN (occurred_at);
CREATE INDEX IF NOT EXISTS events_contact_time_idx
  ON public.events(contact_id, occurred_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_org_type_time_idx
  ON public.events(organization_id, type, occurred_at DESC);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS events_set_org_id ON public.events;
CREATE TRIGGER events_set_org_id BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

-- INSERT is open to authenticated callers AND to anon (server-side webhook
-- handlers run as service role, bypassing RLS; tracker pixels POST through
-- a Phase 1 API endpoint that authenticates differently). For now, the
-- safest stance is auth-only — open it later if a tracker route requires.
DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

COMMENT ON TABLE public.events IS
  'Append-only behavioral telemetry. Distinct from activities (which is the user-facing timeline). BRIN at scale.';
