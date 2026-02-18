import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getQueue, QUEUE_NAMES } from "@/lib/queue";

/**
 * GET /api/creators/:id/queue
 * Returns job_runs with video data, aggregate stats, and Redis queue lengths.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch job_runs for this creator, most recent first
    const { data: jobs, error: jobsError } = await supabaseServer
      .from("job_runs")
      .select("*")
      .eq("creator_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (jobsError) {
      throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    // Fetch associated video data for PROCESS_VIDEO jobs
    const videoIds = (jobs || [])
      .filter((j) => j.video_id)
      .map((j) => j.video_id as string);

    let videoMap: Record<string, { tiktok_id: string; caption: string; thumb_url: string; processing_status: string }> = {};
    if (videoIds.length > 0) {
      const { data: videos } = await supabaseServer
        .from("videos")
        .select("id, tiktok_id, caption, thumb_url, processing_status")
        .in("id", videoIds);

      if (videos) {
        videoMap = Object.fromEntries(videos.map((v) => [v.id, v]));
      }
    }

    // Attach video data to jobs
    const enrichedJobs = (jobs || []).map((job) => ({
      ...job,
      video: job.video_id ? videoMap[job.video_id] || null : null,
    }));

    // Aggregate stats from job_runs
    const stats = {
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
    };
    for (const job of jobs || []) {
      const status = job.status as keyof typeof stats;
      if (status in stats) {
        stats[status]++;
      }
    }

    // Redis queue lengths
    let redisStats = {
      ingest_creator: { queued: 0, processing: 0 },
      process_video: { queued: 0, processing: 0 },
    };
    try {
      const queue = getQueue();
      redisStats = {
        ingest_creator: {
          queued: await queue.getQueueLength(QUEUE_NAMES.INGEST_CREATOR),
          processing: await queue.getProcessingLength(QUEUE_NAMES.INGEST_CREATOR),
        },
        process_video: {
          queued: await queue.getQueueLength(QUEUE_NAMES.PROCESS_VIDEO),
          processing: await queue.getProcessingLength(QUEUE_NAMES.PROCESS_VIDEO),
        },
      };
    } catch (queueError) {
      console.warn("[QueueAPI] Redis stats unavailable:", queueError);
    }

    // Fetch monthly usage
    const month = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseServer
      .from("creator_usage")
      .select("*")
      .eq("creator_id", id)
      .eq("month", month)
      .single();

    return NextResponse.json({
      jobs: enrichedJobs,
      stats,
      redis_stats: redisStats,
      usage: usage || null,
    });
  } catch (error) {
    console.error("[QueueAPI] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch queue data" },
      { status: 500 }
    );
  }
}
