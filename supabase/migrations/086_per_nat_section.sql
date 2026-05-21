-- ── 086_per_nat_section.sql ──────────────────────────────────────────────
-- Faithful Per Nat XLSX section structure on per_nat_entries.
--
-- Natalie's Per NatTim sheet isn't just a flat list grouped by month —
-- it has explicit categorical section headers Willie pointed out
-- 2026-05-21:
--   • Blue month dividers ("Jan-April 2026", "2026-05-01", "2026-06-01"...)
--   • Orange "Owner to Notifiy YYYY" headers — deals where Natalie owns followup
--   • Black "List below that William wanted to mark as stock..." — converted to stock
--   • Red "HOT ONES THAT WE CAN'T GET A HOLD OF..." — escalation
--
-- The Per Nat page grouped by parsed month only, which collapsed every
-- non-month-divider row into "TBD" and dropped the 4 categorical sections
-- entirely. This migration adds section_label / section_kind /
-- section_order so the importer can preserve the XLSX organization and
-- the page can render sections in source order with matching colors.

ALTER TABLE public.per_nat_entries
  ADD COLUMN IF NOT EXISTS section_label text,
  ADD COLUMN IF NOT EXISTS section_kind text
    CHECK (section_kind IS NULL OR section_kind IN (
      'month', 'owner_notify', 'stock_held', 'hot', 'other'
    )),
  ADD COLUMN IF NOT EXISTS section_order integer;

COMMENT ON COLUMN public.per_nat_entries.section_label IS
  'Display name of the XLSX section this row belongs to ("June 2026", "Owner to Notifiy 2023-2024", "Stock — Held too long", "HOT — Can''t reach customer"). Preserved from the XLSX so the Per Nat page mirrors Natalie''s organization exactly.';

COMMENT ON COLUMN public.per_nat_entries.section_kind IS
  'month = blue month divider, owner_notify = orange "Owner to Notifiy YYYY" header, stock_held = black "Stock - held too long", hot = red "HOT ones can''t reach", other = unrecognized header. Drives section color on the Per Nat page.';

COMMENT ON COLUMN public.per_nat_entries.section_order IS
  'Sort key for sections within a status (active/completed/cancelled). Sections render in this numeric order, matching the XLSX top-to-bottom layout.';

CREATE INDEX IF NOT EXISTS idx_pne_section_order
  ON public.per_nat_entries(status, section_order NULLS LAST, sale_date DESC NULLS LAST);
