-- Migration 072: Add total_cost to shows for ROI tracking
--
-- Atlas Spas is a show-based business — booth fees, travel, payroll, etc. are
-- the largest variable expense category. Tracking total cost per show enables
-- profit + ROI calculation on the analytics dashboard, surfacing which shows
-- actually pay back and which lose money.
--
-- Phase 1: single lump-sum field for simplicity. Future migration may split
-- into JSONB line items (booth / travel / payroll / other) if Willie wants
-- finer breakdown.

ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS total_cost numeric(12,2);

COMMENT ON COLUMN public.shows.total_cost IS
  'Total all-in cost of running this show (booth fees + travel + payroll + other). NULL = not yet entered. Used by /analytics to compute profit and ROI%.';
