-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 056: CRM Reviews
-- ═══════════════════════════════════════════════════════════════════════════
-- Unified review feed across Google Business Profile, Yelp, Facebook.
-- One row per source review. AI-drafted responses sit in
-- `ai_response_draft` until a manager approves and posts via the API,
-- at which point `response` + `posted_at` are filled.
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reviews (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id       uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  source            text NOT NULL CHECK (source IN ('google','yelp','facebook','bbb','other')),
  source_review_id  text NOT NULL,
  contact_id        uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  reviewer_name     text,
  reviewer_url      text,
  rating            integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  body              text,
  source_url        text,
  -- Response handling
  ai_response_draft text,
  ai_drafted_at     timestamptz,
  response          text,
  responded_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at      timestamptz,
  posted_at         timestamptz, -- when reviewer originally posted
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  -- AI-classified
  sentiment         numeric(4,3),
  topics            text[] DEFAULT '{}',
  is_escalated      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_review_id)
);

CREATE INDEX IF NOT EXISTS reviews_org_posted_idx     ON public.reviews(organization_id, posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS reviews_location_idx       ON public.reviews(location_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx         ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS reviews_unanswered_idx     ON public.reviews(organization_id, posted_at DESC)
  WHERE responded_at IS NULL;

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS reviews_set_org_id ON public.reviews;
CREATE TRIGGER reviews_set_org_id BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS reviews_updated_at ON public.reviews;
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "reviews_update" ON public.reviews;
CREATE POLICY "reviews_update" ON public.reviews FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

COMMENT ON TABLE public.reviews IS 'Unified Google/Yelp/Facebook reviews. AI drafts approved before post.';
