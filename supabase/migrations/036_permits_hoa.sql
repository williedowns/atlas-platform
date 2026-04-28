-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 036: Permits + HOA Contingency Tracking
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Per 2026-04-28 meeting (Lindy + Robert + Alex):
-- Some contracts depend on a city permit OR HOA approval before delivery.
-- These act as hard-stop gates: cannot schedule/deliver until satisfied.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS needs_permit    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_status   text CHECK (permit_status IN ('pending','approved','denied')),
  ADD COLUMN IF NOT EXISTS permit_number   text,
  ADD COLUMN IF NOT EXISTS permit_jurisdiction text,
  ADD COLUMN IF NOT EXISTS permit_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS needs_hoa       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hoa_status      text CHECK (hoa_status IN ('pending','approved','denied')),
  ADD COLUMN IF NOT EXISTS hoa_approved_at timestamptz;

CREATE INDEX IF NOT EXISTS contracts_permit_pending_idx
  ON public.contracts (id)
  WHERE needs_permit = true AND (permit_status IS NULL OR permit_status = 'pending');

CREATE INDEX IF NOT EXISTS contracts_hoa_pending_idx
  ON public.contracts (id)
  WHERE needs_hoa = true AND (hoa_status IS NULL OR hoa_status = 'pending');

COMMENT ON COLUMN public.contracts.needs_permit  IS 'Contract requires a city/jurisdiction permit before delivery.';
COMMENT ON COLUMN public.contracts.permit_status IS 'NULL = not started; pending / approved / denied.';
COMMENT ON COLUMN public.contracts.needs_hoa     IS 'Contract is contingent on HOA approval before delivery.';
COMMENT ON COLUMN public.contracts.hoa_status    IS 'NULL = not started; pending / approved / denied.';
