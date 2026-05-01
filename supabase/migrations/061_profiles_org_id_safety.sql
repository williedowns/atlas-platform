-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 061: Make profiles.organization_id rock-solid
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ROOT CAUSE: Migration 019 added profiles.organization_id as nullable and
-- backfilled existing rows. Any profile inserted AFTER that migration through
-- a path that forgot to set organization_id (or whose inviter had NULL org)
-- ends up with NULL. Affected users: Alex Broyles, Lindy Daniel, Demo User.
--
-- The RLS policy on profiles requires `organization_id = get_my_org_id()`
-- for non-admins. NULL = NULL evaluates to NULL (not TRUE), so RLS denies
-- those users access to their own profile row. The dashboard's profile
-- fetch returns null, sidebar renders "Profile" + "?" avatar, and every
-- org-scoped query (contracts, leads, shows) returns empty → blank dashboard.
--
-- THIS MIGRATION:
--   1. Backfills any remaining NULL organization_id to the first organization
--   2. Adds a BEFORE INSERT trigger that auto-fills from the inserter's profile
--   3. Adds NOT NULL constraint so future code paths fail loudly, not silently
--
-- Idempotent. Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Backfill ────────────────────────────────────────────────────────────────
-- Single-tenant today (Atlas Spas only). When multi-tenant arrives this will
-- already be a no-op because every new tenant must be invited under their org.
UPDATE public.profiles
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

-- 2. Auto-fill trigger on INSERT ─────────────────────────────────────────────
-- Reuses set_organization_id_from_profile() defined in migration 041, which
-- copies get_my_org_id() into NEW.organization_id when not provided. The
-- existing API routes (/api/admin/invite, /api/admin/send-invite) explicitly
-- set organization_id from the inviter's profile, so this trigger is a
-- safety net that catches any new path (or future direct DB insert) that
-- forgets. Does not overwrite an explicitly-set value.
DROP TRIGGER IF EXISTS profiles_set_org_id ON public.profiles;
CREATE TRIGGER profiles_set_org_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_profile();

-- 3. NOT NULL constraint ─────────────────────────────────────────────────────
-- After backfill, every row has org. Lock it in so any future path that
-- somehow slips a NULL through gets a clear DB error instead of a silently
-- broken user account.
ALTER TABLE public.profiles
  ALTER COLUMN organization_id SET NOT NULL;
