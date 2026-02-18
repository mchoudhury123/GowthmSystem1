-- GROWTHM Core Loop Hardening Migration
-- Run after migration_main_system.sql and migration_cta_analysis.sql
-- Adds: analysis versioning, cost tracking, dedup safety, job stage tracking

-- ============================================================================
-- 1. Analysis versioning columns on VIDEOS
-- ============================================================================
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_version INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'PENDING';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_hash TEXT;

-- Constraint for analysis_status values
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_analysis_status_check;
ALTER TABLE videos ADD CONSTRAINT videos_analysis_status_check
  CHECK (analysis_status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'STALE'));

CREATE INDEX IF NOT EXISTS idx_videos_analysis_status ON videos(analysis_status);

-- ============================================================================
-- 2. Analysis versioning columns on VIDEO_INSIGHTS
-- ============================================================================
ALTER TABLE video_insights ADD COLUMN IF NOT EXISTS analysis_version INTEGER DEFAULT 1;
ALTER TABLE video_insights ADD COLUMN IF NOT EXISTS analysis_hash TEXT;

-- ============================================================================
-- 3. Creator Usage table (monthly cost tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS creator_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- 'YYYY-MM' format
  videos_ingested INTEGER DEFAULT 0,
  videos_analyzed INTEGER DEFAULT 0,
  llm_calls INTEGER DEFAULT 0,
  frames_extracted INTEGER DEFAULT 0,
  whisper_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_usage_unique
  ON creator_usage(creator_id, month);

ALTER TABLE creator_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on creator_usage" ON creator_usage;
CREATE POLICY "Allow all on creator_usage" ON creator_usage FOR ALL USING (true);

-- ============================================================================
-- 4. Prevent duplicate frame assets on retry
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_assets_unique_path
  ON video_assets(video_id, storage_path);

-- ============================================================================
-- 5. Add stage column to job_runs for granular progress tracking
-- ============================================================================
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS stage TEXT;

-- ============================================================================
-- 6. Defensive: ensure tiktok_id UNIQUE constraint exists
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_tiktok_id_unique ON videos(tiktok_id);

-- ============================================================================
-- 7. Usage increment function (generic for any field)
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_usage(
  p_creator_id UUID,
  p_month TEXT,
  p_field TEXT DEFAULT 'videos_ingested',
  p_amount INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  INSERT INTO creator_usage (creator_id, month)
  VALUES (p_creator_id, p_month)
  ON CONFLICT (creator_id, month) DO NOTHING;

  EXECUTE format(
    'UPDATE creator_usage SET %I = %I + $1, updated_at = NOW() WHERE creator_id = $2 AND month = $3',
    p_field, p_field
  ) USING p_amount, p_creator_id, p_month;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Backfill: mark existing analyzed videos
-- ============================================================================
UPDATE videos
SET analysis_status = 'DONE',
    analysis_version = 1
WHERE id IN (SELECT video_id FROM video_insights)
AND analysis_status = 'PENDING';

-- ============================================================================
-- VERIFY
-- ============================================================================
SELECT
  'Hardening migration complete!' as status,
  (SELECT COUNT(*) FROM videos WHERE analysis_status IS NOT NULL) as videos_with_analysis_status,
  (SELECT COUNT(*) FROM videos WHERE analysis_status = 'DONE') as videos_analysis_done;
