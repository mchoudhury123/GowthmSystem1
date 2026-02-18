import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { scrapeTikTokProfile, normalizeApifyVideo } from "@/lib/apify";
import { getQueue, QUEUE_NAMES, type IngestCreatorJob } from "@/lib/queue";

const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-change-in-production";

export async function POST(request: NextRequest) {
  // Security: Check worker secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const job: IngestCreatorJob = await request.json();
    const { creatorId, handle } = job;

    console.log(`[Worker:IngestCreator] Starting ingestion for ${handle} (${creatorId})`);

    // Update job_runs
    const { data: jobRun } = await supabaseServer
      .from("job_runs")
      .insert({
        creator_id: creatorId,
        job_type: "INGEST_CREATOR",
        status: "RUNNING",
        payload: job,
      })
      .select()
      .single();

    try {
      // 1. Scrape TikTok profile with Apify
      const { videos, profile } = await scrapeTikTokProfile(handle, 30);

      console.log(`[Worker:IngestCreator] Found ${videos.length} videos`);

      // 1b. Upsert profile data + daily metrics snapshot
      if (profile) {
        const today = new Date().toISOString().split("T")[0];

        const { error: profileError } = await supabaseServer
          .from("creator_profile")
          .upsert(
            {
              creator_id: creatorId,
              display_name: profile.display_name,
              bio: profile.bio,
              profile_pic_url: profile.profile_pic_url,
              follower_count: profile.follower_count,
              following_count: profile.following_count,
              total_likes: profile.total_likes,
              video_count: profile.video_count,
              verified: profile.verified,
              last_scraped_at: new Date().toISOString(),
            },
            { onConflict: "creator_id" }
          );

        if (profileError) {
          console.warn("[Worker:IngestCreator] Profile upsert error:", profileError.message);
        }

        const { error: metricsError } = await supabaseServer
          .from("creator_daily_metrics")
          .upsert(
            {
              creator_id: creatorId,
              day: today,
              follower_count: profile.follower_count,
              total_likes: profile.total_likes,
              video_count: profile.video_count,
            },
            { onConflict: "creator_id,day" }
          );

        if (metricsError) {
          console.warn("[Worker:IngestCreator] Daily metrics upsert error:", metricsError.message);
        }

        console.log(
          `[Worker:IngestCreator] Profile updated: ${profile.display_name}, ${profile.follower_count} followers`
        );
      }

      if (videos.length === 0) {
        throw new Error("No videos found for this handle");
      }

      // ── 2. Idempotent video upsert ──
      // Phase A: Insert ONLY genuinely new videos (ignoreDuplicates: true)
      // This prevents resetting processing_status on existing videos.
      const normalizedVideos = videos.map((v) => ({
        ...normalizeApifyVideo(v),
        creator_id: creatorId,
      }));

      const { error: insertError } = await supabaseServer
        .from("videos")
        .upsert(normalizedVideos, {
          onConflict: "tiktok_id",
          ignoreDuplicates: true,
        });

      if (insertError) {
        throw new Error(`Failed to insert videos: ${insertError.message}`);
      }

      // Phase B: Update engagement metrics on ALL videos (new + existing)
      // Crucially, this NEVER touches processing_status or analysis_status.
      const tiktokIds = normalizedVideos.map((v) => v.tiktok_id).filter(Boolean);
      for (const nv of normalizedVideos) {
        if (!nv.tiktok_id) continue;
        await supabaseServer
          .from("videos")
          .update({
            views: nv.views,
            likes: nv.likes,
            comments: nv.comments,
            thumb_url: nv.thumb_url,
            source_url: nv.source_url,
          })
          .eq("tiktok_id", nv.tiktok_id);
      }

      // Phase C: Find genuinely PENDING videos for this creator to enqueue
      const { data: pendingVideos } = await supabaseServer
        .from("videos")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("processing_status", "PENDING")
        .in("tiktok_id", tiktokIds);

      console.log(
        `[Worker:IngestCreator] Upserted ${normalizedVideos.length} videos, ${pendingVideos?.length || 0} need processing`
      );

      // 3. Update creator last_ingested_at
      await supabaseServer
        .from("creators")
        .update({ last_ingested_at: new Date().toISOString() })
        .eq("id", creatorId);

      // ── 4. Enqueue with dedup ──
      const queue = getQueue();
      let enqueuedCount = 0;

      for (const video of pendingVideos || []) {
        const jobId = await queue.enqueue(QUEUE_NAMES.PROCESS_VIDEO, {
          videoId: video.id,
        });
        if (jobId) {
          enqueuedCount++;
        }
        // jobId === null means it was already in the queue (dedup)
      }

      // Track usage
      const month = new Date().toISOString().slice(0, 7);
      if (enqueuedCount > 0) {
        await supabaseServer.rpc("increment_usage", {
          p_creator_id: creatorId,
          p_month: month,
          p_field: "videos_ingested",
          p_amount: enqueuedCount,
        });
      }

      console.log(`[Worker:IngestCreator] Enqueued ${enqueuedCount} video processing jobs`);

      // 5. Mark job as done
      if (jobRun) {
        await supabaseServer
          .from("job_runs")
          .update({
            status: "DONE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRun.id);
      }

      // Recompute creator playbook (debounced, non-fatal)
      try {
        const { computeCreatorPlaybook } = await import("@/lib/computePlaybook");
        await computeCreatorPlaybook(creatorId);
      } catch (playbookError) {
        console.warn("[Worker:IngestCreator] Playbook computation failed (non-fatal):", playbookError);
      }

      return NextResponse.json({
        success: true,
        videosFound: videos.length,
        videosUpserted: normalizedVideos.length,
        jobsEnqueued: enqueuedCount,
      });
    } catch (error) {
      // Mark job as failed
      if (jobRun) {
        await supabaseServer
          .from("job_runs")
          .update({
            status: "FAILED",
            error_message: error instanceof Error ? error.message : "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRun.id);
      }

      throw error;
    }
  } catch (error) {
    console.error("[Worker:IngestCreator] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ingestion failed",
      },
      { status: 500 }
    );
  }
}
