// Centralized configuration constants for the Growthm pipeline.
// Bump ANALYSIS_VERSION when the LLM prompt changes to trigger re-analysis.

export const ANALYSIS_VERSION = 1;

export const MAX_VIDEOS_PER_CREATOR_PER_MONTH = 100;

export const MAX_FRAMES_PER_VIDEO = 12;

export const MAX_RETRIES = 3;

export const INGEST_COOLDOWN_MINUTES = 5;

// Redis lock TTL matches the ingest cooldown
export const INGEST_LOCK_TTL_SECONDS = INGEST_COOLDOWN_MINUTES * 60;
