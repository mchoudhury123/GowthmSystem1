// Apify TikTok Scraper Client
// Uses Apify API to fetch TikTok profile videos

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_ACTOR_ID = "clockworks~free-tiktok-scraper"; // Using free TikTok scraper actor

if (!APIFY_API_TOKEN) {
  console.warn("APIFY_API_TOKEN not set. Apify scraping will fail.");
}

export interface ApifyTikTokVideo {
  id: string;
  text: string; // caption
  createTime: number; // Unix timestamp
  videoMeta: {
    duration: number; // seconds
    height: number;
    width: number;
    coverUrl?: string;
  };
  authorMeta: {
    name: string; // @handle
    nickName?: string;
    avatar?: string;
    fans?: number;
    following?: number;
    heart?: number;
    video?: number;
    verified?: boolean;
  };
  webVideoUrl: string; // URL to video
  diggCount: number; // likes
  shareCount: number;
  playCount: number; // views
  commentCount: number;
  musicMeta?: {
    musicName: string;
    musicAuthor: string;
  };
  downloadUrl?: string; // Direct download URL if available
}

export interface ApifyProfileData {
  display_name: string | null;
  bio: string | null;
  profile_pic_url: string | null;
  follower_count: number;
  following_count: number;
  total_likes: number;
  video_count: number;
  verified: boolean;
}

export interface ApifyRunResult {
  videos: ApifyTikTokVideo[];
  profileUrl: string;
  profile: ApifyProfileData | null;
}

export async function scrapeTikTokProfile(handle: string, maxVideos: number = 30): Promise<ApifyRunResult> {
  if (!APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN is not configured");
  }

  // Remove @ from handle if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  const input = {
    profiles: [`https://www.tiktok.com/@${cleanHandle}`],
    resultsPerPage: maxVideos,
    shouldDownloadVideos: false, // We'll download separately
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  };

  console.log(`[Apify] Starting scrape for @${cleanHandle}`);

  // Start the actor run
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify run failed: ${runResponse.status} ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  console.log(`[Apify] Run started: ${runId}`);

  // Wait for run to complete (poll status)
  const result = await waitForRun(runId);

  return {
    videos: result,
    profileUrl: `https://www.tiktok.com/@${cleanHandle}`,
    profile: extractProfileData(result),
  };
}

async function waitForRun(runId: string, maxWaitSeconds: number = 120): Promise<ApifyTikTokVideo[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const statusResponse = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data.status;

    console.log(`[Apify] Run status: ${status}`);

    if (status === "SUCCEEDED") {
      // Fetch results from dataset
      const datasetId = statusData.data.defaultDatasetId;
      return await fetchDataset(datasetId);
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status.toLowerCase()}`);
    }

    // Still running, wait before polling again
    await sleep(5000); // 5 seconds
  }

  throw new Error("Apify run timed out");
}

async function fetchDataset(datasetId: string): Promise<ApifyTikTokVideo[]> {
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to fetch dataset: ${datasetResponse.statusText}`);
  }

  const items = await datasetResponse.json();

  // The scraper returns an array of video objects
  // Filter and normalize the data
  const videos: ApifyTikTokVideo[] = [];

  for (const item of items) {
    if (item.id && item.webVideoUrl) {
      videos.push({
        id: item.id,
        text: item.text || "",
        createTime: item.createTime || Date.now() / 1000,
        videoMeta: {
          duration: item.videoMeta?.duration || 0,
          height: item.videoMeta?.height || 0,
          width: item.videoMeta?.width || 0,
          coverUrl: item.videoMeta?.coverUrl,
        },
        authorMeta: {
          name: item.authorMeta?.name || "",
          nickName: item.authorMeta?.nickName,
          avatar: item.authorMeta?.avatar,
          fans: item.authorMeta?.fans,
          following: item.authorMeta?.following,
          heart: item.authorMeta?.heart,
          video: item.authorMeta?.video,
          verified: item.authorMeta?.verified,
        },
        webVideoUrl: item.webVideoUrl,
        diggCount: item.diggCount || 0,
        shareCount: item.shareCount || 0,
        playCount: item.playCount || 0,
        commentCount: item.commentCount || 0,
        musicMeta: item.musicMeta,
        downloadUrl: item.downloadUrl,
      });
    }
  }

  console.log(`[Apify] Fetched ${videos.length} videos from dataset`);

  return videos;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extract profile data from the first video's authorMeta
export function extractProfileData(videos: ApifyTikTokVideo[]): ApifyProfileData | null {
  const first = videos.find((v) => v.authorMeta?.fans !== undefined);
  if (!first) return null;

  const am = first.authorMeta;
  return {
    display_name: am.nickName || am.name || null,
    bio: null, // Free scraper may not include bio
    profile_pic_url: am.avatar || null,
    follower_count: am.fans || 0,
    following_count: am.following || 0,
    total_likes: am.heart || 0,
    video_count: am.video || 0,
    verified: am.verified || false,
  };
}

// Normalize Apify data to our database schema
export function normalizeApifyVideo(apifyVideo: ApifyTikTokVideo) {
  return {
    tiktok_id: apifyVideo.id,
    caption: apifyVideo.text || "",
    source_url: apifyVideo.webVideoUrl,
    thumb_url: apifyVideo.videoMeta.coverUrl || "",
    duration_s: Math.round(apifyVideo.videoMeta.duration),
    views: apifyVideo.playCount,
    likes: apifyVideo.diggCount,
    comments: apifyVideo.commentCount,
    created_at_ts: new Date(apifyVideo.createTime * 1000).toISOString(),
    processing_status: "PENDING",
    ingest_status: "INGESTED",
  };
}
