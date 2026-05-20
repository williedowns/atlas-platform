-- profiles.active_show_id — per-user "I'm working this show right now" state.
--
-- Replaces the short-lived cookie-based selector. Stored on the user's
-- profile so it follows them across devices. App code (lib/active-show.ts)
-- treats this as null when the linked show's end_date is before today, so
-- weekend selections naturally clear the Monday after.
--
-- Set/cleared via:
--   POST   /api/active-show { show_id }
--   DELETE /api/active-show
--   contract creation Step 1 (auto-set when a rep picks a show)
--   the /select-active-show picker shown after login

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_show_id uuid REFERENCES public.shows(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_show_id IS
  'The show this user is currently working. Read via lib/active-show.ts, which treats it as null after the linked show end_date has passed (auto-clears Monday after a weekend show).';

CREATE INDEX IF NOT EXISTS idx_profiles_active_show_id
  ON public.profiles(active_show_id)
  WHERE active_show_id IS NOT NULL;
