-- ── 019_organizations.sql ──────────────────────────────────────────────────
-- Salta SaaS foundation: organizations table + org_id columns on core tables.
-- Phase 1 of multi-tenancy. RLS scoping by org comes in a future migration.
-- ---------------------------------------------------------------------------

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text        NOT NULL,
  slug              text        NOT NULL UNIQUE,
  logo_url          text,
  primary_color     text        NOT NULL DEFAULT '#00929C',
  from_email        text,
  from_name         text,
  subscription_tier text        NOT NULL DEFAULT 'starter',
  stripe_customer_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write organizations for now
CREATE POLICY "organizations_admin_only" ON public.organizations
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed Atlas Spas as the first organization
INSERT INTO public.organizations (name, slug, primary_color, from_name)
VALUES ('Atlas Spas', 'atlas-spas', '#00929C', 'Atlas Spas')
ON CONFLICT (slug) DO NOTHING;

-- Add organization_id to core tables (nullable for backward compatibility)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_units
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- leads table added in a later migration; skip if not yet created
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill existing rows to the Atlas Spas org
DO $$
DECLARE
  atlas_org_id uuid;
BEGIN
  SELECT id INTO atlas_org_id FROM public.organizations WHERE slug = 'atlas-spas';

  UPDATE public.profiles       SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  UPDATE public.locations      SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  UPDATE public.shows          SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  UPDATE public.customers      SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  UPDATE public.contracts      SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  UPDATE public.inventory_units SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    UPDATE public.leads SET organization_id = atlas_org_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- Index for fast org lookups
CREATE INDEX IF NOT EXISTS idx_profiles_org        ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_org       ON public.locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org       ON public.contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_org ON public.inventory_units(organization_id);
