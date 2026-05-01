-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 060: CRM AI Runs + Scoring Models
-- ═══════════════════════════════════════════════════════════════════════════
-- `ai_runs` is the audit + cost-control log for every LLM call across
-- Atlas Copilot — call summarization, email/SMS draft, segment-from-NL,
-- next-best-action, deal coaching, AI receptionist, review-response draft.
-- Powers per-org budget caps, model-quality regression detection, and
-- compliance review.
--
-- `scoring_models` stores predictive lead scoring config + training
-- metadata (XGBoost on closed-won corpus per the plan).
--
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id        uuid REFERENCES public.contacts(id)      ON DELETE SET NULL,
  opportunity_id    uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  conversation_id   uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  capability        text NOT NULL,
                      -- e.g. call_summary | email_draft | sms_draft | segment_nl |
                      -- next_best_action | deal_coach | review_response |
                      -- showroom_recommend | spam_classify | ai_receptionist
  prompt_template   text,
  prompt_version    text,
  model             text NOT NULL,  -- e.g. claude-sonnet-4-6, gpt-4o, whisper-1, deepgram-nova-3
  input_tokens      integer,
  output_tokens     integer,
  total_tokens      integer GENERATED ALWAYS AS (
                      coalesce(input_tokens, 0) + coalesce(output_tokens, 0)
                    ) STORED,
  cost_cents        numeric(12,4),
  latency_ms        integer,
  status            text NOT NULL DEFAULT 'success'
                      CHECK (status IN ('success','error','timeout','content_blocked','rate_limited')),
  error             text,
  request_payload   jsonb,
  response_payload  jsonb,
  is_human_reviewed boolean NOT NULL DEFAULT false,
  human_rating      integer CHECK (human_rating IS NULL OR (human_rating >= 1 AND human_rating <= 5)),
  triggered_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scoring_models (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  model_version   text NOT NULL,
  algorithm       text NOT NULL,  -- xgboost | logistic_regression | rule_based | claude_few_shot
  features        jsonb NOT NULL DEFAULT '[]'::jsonb,
                    -- array of: {feature_name, source_table, source_column, transform}
  hyperparameters jsonb DEFAULT '{}'::jsonb,
  performance     jsonb DEFAULT '{}'::jsonb,
                    -- {auc, precision, recall, f1, sample_size, train_window}
  artifact_url    text,  -- pointer to S3 / Supabase Storage with serialized model
  is_active       boolean NOT NULL DEFAULT false,
  trained_at      timestamptz,
  trained_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name, model_version)
);

CREATE INDEX IF NOT EXISTS ai_runs_org_capability_time_idx
  ON public.ai_runs(organization_id, capability, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_org_cost_idx
  ON public.ai_runs(organization_id, created_at DESC) INCLUDE (cost_cents);
CREATE INDEX IF NOT EXISTS ai_runs_contact_idx ON public.ai_runs(contact_id);
CREATE INDEX IF NOT EXISTS ai_runs_status_idx  ON public.ai_runs(status) WHERE status <> 'success';

CREATE INDEX IF NOT EXISTS scoring_models_org_active_idx
  ON public.scoring_models(organization_id, is_active);

-- ─── Triggers ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS ai_runs_set_org_id ON public.ai_runs;
CREATE TRIGGER ai_runs_set_org_id BEFORE INSERT ON public.ai_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS scoring_models_set_org_id ON public.scoring_models;
CREATE TRIGGER scoring_models_set_org_id BEFORE INSERT ON public.scoring_models
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_profile();

DROP TRIGGER IF EXISTS scoring_models_updated_at ON public.scoring_models;
CREATE TRIGGER scoring_models_updated_at BEFORE UPDATE ON public.scoring_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_models  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_runs_select" ON public.ai_runs;
CREATE POLICY "ai_runs_select" ON public.ai_runs FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "ai_runs_insert" ON public.ai_runs;
CREATE POLICY "ai_runs_insert" ON public.ai_runs FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "ai_runs_update_review" ON public.ai_runs;
CREATE POLICY "ai_runs_update_review" ON public.ai_runs FOR UPDATE USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
    AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
         OR organization_id = public.get_my_org_id())
  )
);

DROP POLICY IF EXISTS "scoring_models_select" ON public.scoring_models;
CREATE POLICY "scoring_models_select" ON public.scoring_models FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR organization_id = public.get_my_org_id()
  )
);

DROP POLICY IF EXISTS "scoring_models_insert" ON public.scoring_models;
CREATE POLICY "scoring_models_insert" ON public.scoring_models FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "scoring_models_update" ON public.scoring_models;
CREATE POLICY "scoring_models_update" ON public.scoring_models FOR UPDATE USING (
  auth.role() = 'authenticated' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

COMMENT ON TABLE public.ai_runs IS 'Audit trail of every Atlas Copilot LLM call. Drives cost caps, quality review, regression detection.';
COMMENT ON TABLE public.scoring_models IS 'Predictive lead scoring config + training metadata. XGBoost on closed-won corpus per Phase 2 plan.';
