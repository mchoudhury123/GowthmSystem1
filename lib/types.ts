export type Verdict = "REPEAT" | "MODIFY" | "STOP";

export type HookType = "QUESTION" | "BOLD_CLAIM" | "STORY" | "PROBLEM_SOLUTION" | "OTHER";
export type Format = "TALKING_HEAD" | "BROLL" | "MONTAGE" | "TEXT_ON_SCREEN" | "MIXED";
export type CTATiming = "EARLY" | "MID" | "LATE" | "NONE";
export type LengthBucket = "<15" | "15-25" | "25-40" | "40+";

export type ProcessingStatus =
  | "PENDING"
  | "DOWNLOADING"
  | "TRANSCRIBING"
  | "EXTRACTING_FRAMES"
  | "ANALYZING"
  | "DONE"
  | "FAILED";

export interface InsightLabels {
  hook_type: HookType;
  format: Format;
  cta_timing: CTATiming;
  length_bucket: LengthBucket;
}

export interface CTAAnalysis {
  cta_detected: boolean;
  cta_phrase: string | null;
  cta_position_percent: number | null;
  cta_timing: CTATiming;
  cta_reasoning: string;
}

export interface VideoInsight {
  id: string;
  video_id: string;
  verdict: Verdict;
  why: string[];
  next_action: string;
  labels: InsightLabels;
  visual_notes?: string[] | null;
  cta_analysis?: CTAAnalysis | null;
  created_at: string;
}

export interface Video {
  id: string;
  creator_id: string;
  tiktok_id: string | null;
  caption: string;
  thumb_url: string;
  duration_s: number;
  views: number;
  likes: number;
  comments: number;
  source_url?: string;
  processing_status?: ProcessingStatus;
  processing_error?: string | null;
  transcript?: string | null;
  created_at: string;
  created_at_ts?: string;
  insight?: VideoInsight;
}

export interface WeeklySummary {
  id: string;
  creator_id: string;
  do_more: string[];
  stop_doing: string[];
  created_at: string;
}

export interface Creator {
  id: string;
  handle: string;
  niche: string | null;
  last_ingested_at?: string;
  created_at: string;
}

export interface DashboardData {
  creator: Creator;
  creator_profile?: CreatorProfile | null;
  weekly_summary: WeeklySummary | null;
  recent_videos: Video[];
  processing_stats?: {
    total: number;
    pending: number;
    downloading: number;
    transcribing: number;
    extracting_frames: number;
    analyzing: number;
    done: number;
    failed: number;
  };
  cached_dashboard?: CachedDashboard | null;
}

export interface Pattern {
  id: string;
  title: string;
  description: string;
  count: number;
  success_rate: number;
}

// --- Creator Profile ---
export interface CreatorProfile {
  creator_id: string;
  display_name: string | null;
  bio: string | null;
  profile_pic_url: string | null;
  follower_count: number;
  following_count: number;
  total_likes: number;
  video_count: number;
  verified: boolean;
  region: string | null;
  last_scraped_at: string | null;
  created_at?: string;
}

// --- Creator Daily Metrics ---
export interface CreatorDailyMetric {
  id: string;
  creator_id: string;
  day: string;
  follower_count: number;
  total_likes: number;
  video_count: number;
}

// --- Video Asset ---
export type AssetType = "FRAME" | "AUDIO" | "VIDEO";

export interface VideoAsset {
  id: string;
  video_id: string;
  asset_type: AssetType;
  storage_path: string;
  public_url: string | null;
  meta: Record<string, unknown>;
}

// --- Cached Dashboard ---
export interface CachedDashboard {
  profile: CreatorProfile | null;
  timeSeries: {
    days: string[];
    followers: number[];
    totalLikes: number[];
  };
  performance: {
    avgViews: number;
    medianViews: number;
    likeRate: number;
    commentRate: number;
    postingCadence: number;
    totalVideos: number;
  };
  verdictCounts: {
    REPEAT: number;
    MODIFY: number;
    STOP: number;
  };
  topRepeatLabels: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  topStopLabels: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  whatToDoNext: Array<{
    action: string;
    exampleVideoIds: string[];
  }>;
  whatToStop: Array<{
    action: string;
    exampleVideoIds: string[];
  }>;
  computedAt: string;
}
