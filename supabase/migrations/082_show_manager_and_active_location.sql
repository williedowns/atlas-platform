-- Round 1 additions to the active-workspace system:
--   1. Add 'show_manager' to the allowed role set (treated like sales_rep for
--      now from a permissions standpoint — nav items get it added in app code).
--   2. Add profiles.active_location_id for sales reps who work a showroom
--      instead of a show. Mutually exclusive with active_show_id in app code
--      (setting one clears the other via the /api/active-show endpoint).
--
-- A future migration will add lat/lng to locations for the geofence-based
-- skip-the-picker behavior. Not in this round.

-- 1. Expand the role CHECK constraint to include 'show_manager'.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','manager','sales_rep','show_manager','bookkeeper','field_crew','customer'));

-- 2. Add active_location_id for "I'm working at this showroom today" state.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_location_id IS
  'The showroom this user is currently working at. Mutually exclusive with active_show_id — the /api/active-show endpoint clears one when setting the other.';

CREATE INDEX IF NOT EXISTS idx_profiles_active_location_id
  ON public.profiles(active_location_id)
  WHERE active_location_id IS NOT NULL;
