-- Migration 011: Audit Trail
-- Logs every significant user action with timestamp, user, entity, and metadata

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,        -- e.g. 'contract.created', 'contract.signed', 'payment.collected', 'status.changed'
  entity_type text NOT NULL,   -- 'contract', 'payment', 'inventory_unit', 'customer', 'user'
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs(user_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs(action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin/manager/bookkeeper can read audit logs
CREATE POLICY "audit_logs_read" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'bookkeeper')
    )
  );

-- System can insert (via service role or authenticated users)
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
