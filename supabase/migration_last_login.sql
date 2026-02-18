-- Migration: Add last_login_at to creators for re-engagement tracking
-- Used to detect new weekly snapshots since the user's last visit.

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN creators.last_login_at IS
  'Tracks when the creator last acknowledged new insights. Used for re-engagement banners.';
