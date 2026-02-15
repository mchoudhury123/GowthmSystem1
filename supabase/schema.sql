-- Growthm Database Schema
-- Week 1 Minimal Schema for TikTok Content Intelligence

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CREATORS TABLE
-- ============================================================================
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle TEXT UNIQUE NOT NULL,
  niche TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creators_handle ON creators(handle);

-- ============================================================================
-- VIDEOS TABLE
-- ============================================================================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  tiktok_id TEXT,
  caption TEXT NOT NULL,
  thumb_url TEXT NOT NULL,
  source_url TEXT,
  duration_s INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'PENDING',
  ingest_status TEXT DEFAULT 'NEW',
  created_at_ts TIMESTAMPTZ,           -- Actual TikTok post date
  created_at TIMESTAMPTZ DEFAULT NOW()  -- DB insert time
);

CREATE INDEX idx_videos_creator_id ON videos(creator_id);
CREATE INDEX idx_videos_created_at_ts ON videos(created_at_ts DESC);
CREATE INDEX idx_videos_tiktok_id ON videos(tiktok_id);

-- ============================================================================
-- VIDEO INSIGHTS TABLE
-- ============================================================================
CREATE TABLE video_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID UNIQUE NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('REPEAT', 'MODIFY', 'STOP')),
  why_json JSONB NOT NULL,  -- Array of strings
  next_action TEXT NOT NULL,
  labels_json JSONB NOT NULL,  -- Object with hook_type, format, cta_timing, length_bucket
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_insights_video_id ON video_insights(video_id);
CREATE INDEX idx_video_insights_verdict ON video_insights(verdict);

-- ============================================================================
-- WEEKLY SUMMARY TABLE
-- ============================================================================
CREATE TABLE weekly_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  do_more_json JSONB NOT NULL,  -- Array of strings
  stop_doing_json JSONB NOT NULL,  -- Array of strings
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_summary_creator_id ON weekly_summary(creator_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- ============================================================================
-- For Week 1 with no auth, we'll enable RLS but allow all operations
-- In production, you would restrict based on user authentication

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summary ENABLE ROW LEVEL SECURITY;

-- Week 1: Allow all operations (no auth)
-- Replace these policies when you add authentication in Week 2+

CREATE POLICY "Allow all on creators" ON creators FOR ALL USING (true);
CREATE POLICY "Allow all on videos" ON videos FOR ALL USING (true);
CREATE POLICY "Allow all on video_insights" ON video_insights FOR ALL USING (true);
CREATE POLICY "Allow all on weekly_summary" ON weekly_summary FOR ALL USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get creator dashboard data
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
      SELECT json_agg(
        json_build_object(
          'id', v.id,
          'creator_id', v.creator_id,
          'tiktok_id', v.tiktok_id,
          'caption', v.caption,
          'thumb_url', v.thumb_url,
          'duration_s', v.duration_s,
          'views', v.views,
          'likes', v.likes,
          'comments', v.comments,
          'created_at', v.created_at,
          'insight', (
            SELECT json_build_object(
              'id', vi.id,
              'video_id', vi.video_id,
              'verdict', vi.verdict,
              'why', vi.why_json,
              'next_action', vi.next_action,
              'labels', vi.labels_json,
              'created_at', vi.created_at
            )
            FROM video_insights vi
            WHERE vi.video_id = v.id
          )
        )
      )
      FROM (
        SELECT * FROM videos
        WHERE creator_id = p_creator_id
        ORDER BY created_at_ts DESC
        LIMIT 30
      ) v
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NOTES FOR PRODUCTION
-- ============================================================================
-- 1. Add user authentication (Supabase Auth)
-- 2. Update RLS policies to restrict access based on user_id
-- 3. Add indexes for performance optimization as data grows
-- 4. Consider partitioning videos table by created_at for large datasets
-- 5. Add triggers for automatic timestamp updates
-- 6. Add constraints for data validation (e.g., views >= 0)
