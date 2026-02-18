-- Migration: Add recommendations_json column for instruction-level recommendations (v2)
-- This stores verdict-specific execution instructions generated during AI analysis.

ALTER TABLE video_insights
  ADD COLUMN IF NOT EXISTS recommendations_json JSONB;

COMMENT ON COLUMN video_insights.recommendations_json IS
  'Verdict-specific execution instructions: template (REPEAT), change list (MODIFY), or alternative (STOP)';
