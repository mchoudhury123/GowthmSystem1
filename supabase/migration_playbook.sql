-- Migration: Creator Playbook — stores the dominant winning content cluster per creator
-- One row per creator, upserted on recomputation.

CREATE TABLE IF NOT EXISTS creator_playbook (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  dominant_hook_type TEXT NOT NULL,
  dominant_format TEXT NOT NULL,
  dominant_length_bucket TEXT NOT NULL,
  dominant_cta_window TEXT NOT NULL,
  supporting_video_count INT NOT NULL DEFAULT 0,
  avg_like_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  median_like_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  performance_delta_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  experiment_status TEXT NOT NULL DEFAULT 'Stable',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_creator ON creator_playbook(creator_id);

ALTER TABLE creator_playbook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on creator_playbook" ON creator_playbook FOR ALL USING (true);

COMMENT ON TABLE creator_playbook IS
  'Dominant winning content cluster per creator — hook + format + length + CTA timing';
