-- ── 022_role_permissions.sql ────────────────────────────────────────────────
-- Adds role_permissions JSONB to organizations.
-- Stores per-role feature toggles: which features each role can access.
-- Admin role always has full access and is not stored here.
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS role_permissions jsonb NOT NULL DEFAULT '{
    "manager":    {"contracts":true,  "leads":true,  "shows":true,  "analytics":true,  "inventory":true,  "bookkeeper":true},
    "sales_rep":  {"contracts":true,  "leads":true,  "shows":true,  "analytics":false, "inventory":false, "bookkeeper":false},
    "bookkeeper": {"contracts":true,  "leads":false, "shows":false, "analytics":false, "inventory":false, "bookkeeper":true},
    "field_crew": {"contracts":false, "leads":false, "shows":false, "analytics":false, "inventory":false, "bookkeeper":false}
  }'::jsonb;

-- Update any existing org rows that have a NULL (shouldn't happen but safe)
UPDATE public.organizations
  SET role_permissions = '{
    "manager":    {"contracts":true,  "leads":true,  "shows":true,  "analytics":true,  "inventory":true,  "bookkeeper":true},
    "sales_rep":  {"contracts":true,  "leads":true,  "shows":true,  "analytics":false, "inventory":false, "bookkeeper":false},
    "bookkeeper": {"contracts":true,  "leads":false, "shows":false, "analytics":false, "inventory":false, "bookkeeper":true},
    "field_crew": {"contracts":false, "leads":false, "shows":false, "analytics":false, "inventory":false, "bookkeeper":false}
  }'::jsonb
  WHERE role_permissions IS NULL;
