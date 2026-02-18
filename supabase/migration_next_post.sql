-- Migration: creator_next_post table
-- Stores the "Post This Next" recommendation per creator.
-- One row per creator, upsert-safe on creator_id.

CREATE TABLE IF NOT EXISTS creator_next_post (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  hook_type TEXT NOT NULL,
  format TEXT NOT NULL,
  length_bucket TEXT NOT NULL,
  cta_window TEXT NOT NULL,
  suggested_topic TEXT NOT NULL DEFAULT '',
  hook_variant_1 TEXT NOT NULL DEFAULT '',
  hook_variant_2 TEXT NOT NULL DEFAULT '',
  hook_variant_3 TEXT NOT NULL DEFAULT '',
  structure_outline JSONB NOT NULL DEFAULT '{}',
  based_on_cluster_video_count INT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_next_post_creator ON creator_next_post(creator_id);

ALTER TABLE creator_next_post ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on creator_next_post" ON creator_next_post FOR ALL USING (true);
