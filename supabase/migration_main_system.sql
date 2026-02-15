-- GROWTHM Main System Migration
-- Run this in the Supabase SQL editor after schema.sql and migration_week2.sql
-- Creates: creator_profile, creator_daily_metrics, video_assets, creator_cached_dashboard
-- Alters: video_insights (add visual_notes_json), videos (add EXTRACTING_FRAMES status)

-- ============================================
-- 1. creator_profile (1:1 with creators)
-- ============================================
CREATE TABLE IF NOT EXISTS creator_profile (
  creator_id UUID PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  profile_pic_url TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  region TEXT,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_profile_creator_id ON creator_profile(creator_id);

ALTER TABLE creator_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on creator_profile" ON creator_profile;
CREATE POLICY "Allow all on creator_profile" ON creator_profile FOR ALL USING (true);

-- ============================================
-- 2. creator_daily_metrics (time series for charts)
-- ============================================
CREATE TABLE IF NOT EXISTS creator_daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  follower_count INTEGER DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_daily_metrics_unique
  ON creator_daily_metrics(creator_id, day);
CREATE INDEX IF NOT EXISTS idx_creator_daily_metrics_creator_day
  ON creator_daily_metrics(creator_id, day DESC);

ALTER TABLE creator_daily_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on creator_daily_metrics" ON creator_daily_metrics;
CREATE POLICY "Allow all on creator_daily_metrics" ON creator_daily_metrics FOR ALL USING (true);

-- ============================================
-- 3. video_assets (frames, audio, video refs)
-- ============================================
CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('FRAME', 'AUDIO', 'VIDEO')),
  storage_path TEXT NOT NULL,
  public_url TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_assets_video_type ON video_assets(video_id, asset_type);

ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on video_assets" ON video_assets;
CREATE POLICY "Allow all on video_assets" ON video_assets FOR ALL USING (true);

-- ============================================
-- 4. creator_cached_dashboard (fast overview cache)
-- ============================================
CREATE TABLE IF NOT EXISTS creator_cached_dashboard (
  creator_id UUID PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  cache_json JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE creator_cached_dashboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on creator_cached_dashboard" ON creator_cached_dashboard;
CREATE POLICY "Allow all on creator_cached_dashboard" ON creator_cached_dashboard FOR ALL USING (true);

-- ============================================
-- 5. Add visual_notes_json to video_insights
-- ============================================
ALTER TABLE video_insights ADD COLUMN IF NOT EXISTS visual_notes_json JSONB;

-- ============================================
-- 6. Update processing_status CHECK to include EXTRACTING_FRAMES
-- ============================================
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_processing_status_check;
ALTER TABLE videos ADD CONSTRAINT videos_processing_status_check
  CHECK (processing_status IN ('PENDING', 'DOWNLOADING', 'TRANSCRIBING', 'EXTRACTING_FRAMES', 'ANALYZING', 'DONE', 'FAILED'));

-- ============================================
-- 7. Update get_creator_dashboard function
-- ============================================
DROP FUNCTION IF EXISTS get_creator_dashboard(UUID);
CREATE OR REPLACE FUNCTION get_creator_dashboard(p_creator_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'creator', (SELECT row_to_json(c) FROM creators c WHERE c.id = p_creator_id),
    'weekly_summary', (
      SELECT row_to_json(ws)
      FROM weekly_summary ws
      WHERE ws.creator_id = p_creator_id
    ),
    'recent_videos', (
      SELECT COALESCE(json_agg(vr), '[]'::json)
      FROM (
        SELECT
          v.*,
          (SELECT row_to_json(vi)
           FROM video_insights vi WHERE vi.video_id = v.id) as insight
        FROM videos v
        WHERE v.creator_id = p_creator_id
        ORDER BY v.created_at_ts DESC NULLS LAST
        LIMIT 50
      ) vr
    ),
    'processing_stats', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE processing_status = 'PENDING'),
        'downloading', COUNT(*) FILTER (WHERE processing_status = 'DOWNLOADING'),
        'transcribing', COUNT(*) FILTER (WHERE processing_status = 'TRANSCRIBING'),
        'extracting_frames', COUNT(*) FILTER (WHERE processing_status = 'EXTRACTING_FRAMES'),
        'analyzing', COUNT(*) FILTER (WHERE processing_status = 'ANALYZING'),
        'done', COUNT(*) FILTER (WHERE processing_status = 'DONE'),
        'failed', COUNT(*) FILTER (WHERE processing_status = 'FAILED')
      )
      FROM videos
      WHERE creator_id = p_creator_id
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
