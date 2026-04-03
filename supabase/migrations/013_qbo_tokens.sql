-- QBO OAuth tokens (single-row table — one QBO connection per company)
CREATE TABLE IF NOT EXISTS public.qbo_tokens (
  id integer PRIMARY KEY DEFAULT 1,
  realm_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Only admins can read/write QBO tokens
ALTER TABLE public.qbo_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qbo_tokens_admin_only" ON public.qbo_tokens
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
