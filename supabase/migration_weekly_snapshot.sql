-- Migration: Expand weekly_summary for rich weekly snapshots with drift detection
-- Supports one row per creator per week (drops old unique-on-creator_id constraint)

-- Drop the unique constraint on creator_id so we can store one row per week
ALTER TABLE weekly_summary DROP CONSTRAINT IF EXISTS weekly_summary_creator_id_key;

-- Add new columns
ALTER TABLE weekly_summary ADD COLUMN IF NOT EXISTS week_start DATE;
ALTER TABLE weekly_summary ADD COLUMN IF NOT EXISTS snapshot_json JSONB;
ALTER TABLE weekly_summary ADD COLUMN IF NOT EXISTS deltas_json JSONB;
ALTER TABLE weekly_summary ADD COLUMN IF NOT EXISTS drift_flags TEXT[] DEFAULT '{}';
ALTER TABLE weekly_summary ADD COLUMN IF NOT EXISTS insight_bullets TEXT[] DEFAULT '{}';
ALTER TABLE weekly_summary ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- Backfill week_start for existing rows
UPDATE weekly_summary SET week_start = created_at::date WHERE week_start IS NULL;

-- Unique constraint: one snapshot per creator per week
CREATE UNIQUE INDEX IF NOT EXISTS weekly_summary_creator_week_idx
  ON weekly_summary(creator_id, week_start);

COMMENT ON COLUMN weekly_summary.snapshot_json IS
  'Weekly metrics snapshot: avg_duration, avg_like_rate, distributions, cadence';
COMMENT ON COLUMN weekly_summary.deltas_json IS
  'Week-over-week percentage deltas for key metrics';
COMMENT ON COLUMN weekly_summary.drift_flags IS
  'Detected drift patterns: Length Drift, Consistency Drop, Hook Experimentation Phase';
COMMENT ON COLUMN weekly_summary.insight_bullets IS
  '3 deterministic insight statements derived from snapshot + deltas';
COMMENT ON COLUMN weekly_summary.recommendation IS
  'Single directional recommendation for the creator';
