-- Migration: Add CTA analysis column to video_insights
-- Stores structured CTA detection data: phrase, position, timing, and reasoning

ALTER TABLE video_insights
  ADD COLUMN IF NOT EXISTS cta_analysis_json JSONB;

COMMENT ON COLUMN video_insights.cta_analysis_json IS 'Structured CTA analysis: {cta_detected, cta_phrase, cta_position_percent, cta_timing, cta_reasoning}';
