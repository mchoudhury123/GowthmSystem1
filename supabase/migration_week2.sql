-- Growthm Week 2 Migration
-- Adds real processing pipeline support

-- ============================================================================
-- ALTER VIDEOS TABLE - Add processing fields
-- ============================================================================

ALTER TABLE videos ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS ingest_status TEXT DEFAULT 'INGESTED' CHECK (ingest_status IN ('QUEUED', 'INGESTED', 'FAILED'));
ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'DONE', 'FAILED'));
ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add unique constraint on tiktok_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_tiktok_id_unique ON videos(tiktok_id);

-- Add indexes for status queries
CREATE INDEX IF NOT EXISTS idx_videos_processing_status ON videos(processing_status);
CREATE INDEX IF NOT EXISTS idx_videos_ingest_status ON videos(ingest_status);

-- ============================================================================
-- ALTER CREATORS TABLE - Add ingestion tracking
-- ============================================================================

ALTER TABLE creators ADD COLUMN IF NOT EXISTS last_ingested_at TIMESTAMPTZ;

-- ============================================================================
-- CREATE JOB_RUNS TABLE - Track background jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('INGEST_CREATOR', 'PROCESS_VIDEO')),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_creator_id ON job_runs(creator_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_video_id ON job_runs(video_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_type ON job_runs(job_type);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update the existing get_creator_dashboard to include new fields
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
          'source_url', v.source_url,
          'created_at', v.created_at,
          'created_at_ts', v.created_at_ts,
          'processing_status', v.processing_status,
          'processing_error', v.processing_error,
          'transcript', v.transcript,
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
        ORDER BY created_at DESC
        LIMIT 50
      ) v
    ),
    'processing_stats', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE processing_status = 'PENDING'),
        'downloading', COUNT(*) FILTER (WHERE processing_status = 'DOWNLOADING'),
        'transcribing', COUNT(*) FILTER (WHERE processing_status = 'TRANSCRIBING'),
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

-- Function to get pending videos for processing
CREATE OR REPLACE FUNCTION get_pending_videos(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  tiktok_id TEXT,
  source_url TEXT,
  duration_s INTEGER,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  processing_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.creator_id,
    v.tiktok_id,
    v.source_url,
    v.duration_s,
    v.views,
    v.likes,
    v.comments,
    v.processing_status
  FROM videos v
  WHERE v.processing_status IN ('PENDING', 'FAILED')
  AND v.source_url IS NOT NULL
  ORDER BY v.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE EXISTING DATA
-- ============================================================================

-- Set source_url from existing data (if you had test data)
-- This is optional - new data will have source_url from Apify

-- Mark existing videos without insights as PENDING
UPDATE videos
SET processing_status = 'DONE'
WHERE id IN (SELECT video_id FROM video_insights);

-- Mark videos with insights as DONE
UPDATE videos
SET processing_status = 'PENDING'
WHERE id NOT IN (SELECT video_id FROM video_insights)
AND processing_status = 'PENDING';

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

SELECT
  'Migration complete!' as status,
  (SELECT COUNT(*) FROM videos WHERE processing_status IS NOT NULL) as videos_with_status,
  (SELECT COUNT(*) FROM job_runs) as job_runs_count;
