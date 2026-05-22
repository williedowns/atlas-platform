-- Migration 087 — Blem (blemish) functionality
--
-- Adds structured storage for blem details + photos on inventory units.
-- Replaces the previous practice of pasting Google Drive URLs into the
-- notes field. Photos live in Supabase Storage; rows in
-- inventory_blem_photos point to them.
--
-- Contract-side blem evidence (line item snapshot + customer acknowledgment
-- initials) lives in the existing JSONB columns (contracts.line_items,
-- contracts.signature_metadata) so no contract schema change is required.

-- ── 1. Inventory unit blem description ─────────────────────────────────────
-- Freeform damage description (where, what, severity narrative). Nullable
-- because non-blem units don't need it. unit_type='blem' is the canonical
-- flag for "this is a blem"; the description is the human-readable detail.
ALTER TABLE inventory_units
  ADD COLUMN IF NOT EXISTS blem_description TEXT NULL;

-- ── 2. Blem photos table ───────────────────────────────────────────────────
-- One row per uploaded photo. Soft-deletes via deleted_at so a previously-
-- snapshotted contract line item still references valid URLs even after the
-- inventory team removes a photo from active view.
CREATE TABLE IF NOT EXISTS inventory_blem_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_unit_id UUID NOT NULL REFERENCES inventory_units(id) ON DELETE CASCADE,
  photo_url       TEXT NOT NULL,
  caption         TEXT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS inventory_blem_photos_unit_idx
  ON inventory_blem_photos (inventory_unit_id)
  WHERE deleted_at IS NULL;

-- ── 3. RLS on inventory_blem_photos ───────────────────────────────────────
-- Mirrors the inventory_units access pattern: authenticated users can read,
-- only admin/manager roles can write.
ALTER TABLE inventory_blem_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blem_photos_read ON inventory_blem_photos;
CREATE POLICY blem_photos_read
  ON inventory_blem_photos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS blem_photos_write ON inventory_blem_photos;
CREATE POLICY blem_photos_write
  ON inventory_blem_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'sales_rep')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'sales_rep')
    )
  );

-- ── 4. Storage bucket for blem photos ──────────────────────────────────────
-- Public read because URLs are unguessable UUIDs and the photos are shown
-- to customers at the kiosk. Writes are constrained by the storage RLS
-- policies below.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blem-photos',
  'blem-photos',
  true,
  10485760,  -- 10 MB cap per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — anyone authenticated can upload, public can read.
-- Object key convention enforced by the application layer: `{unit_id}/{uuid}.{ext}`.
DROP POLICY IF EXISTS "blem photos public read" ON storage.objects;
CREATE POLICY "blem photos public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'blem-photos');

DROP POLICY IF EXISTS "blem photos authenticated upload" ON storage.objects;
CREATE POLICY "blem photos authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blem-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'sales_rep')
    )
  );

DROP POLICY IF EXISTS "blem photos authenticated delete" ON storage.objects;
CREATE POLICY "blem photos authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blem-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

-- ── 5. Comment for future archaeologists ───────────────────────────────────
COMMENT ON COLUMN inventory_units.blem_description IS
  'Human-readable description of blemishes/damage on a unit where unit_type=''blem''. Snapshotted into contract line items at sale time.';
COMMENT ON TABLE inventory_blem_photos IS
  'Photos documenting blemishes on inventory units. Soft-deleted to preserve historical contract references. Files stored in the blem-photos bucket.';
