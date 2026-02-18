import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { downloadAndExtractAudio, cleanupTempFiles } from "@/lib/videoProcessing";
import { transcribeAudio } from "@/lib/transcription";
import { generateInsights, generateMultimodalInsights } from "@/lib/insights";
import { extractAndUploadFrames } from "@/lib/frameExtraction";
import { computeAnalysisHash } from "@/lib/analysisHash";
import { ANALYSIS_VERSION } from "@/lib/config";
import type { ProcessVideoJob } from "@/lib/queue";

const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-change-in-production";

// Helper: update job_runs.stage for Queue page visibility
async function updateJobStage(jobRunId: string | undefined, stage: string) {
  if (!jobRunId) return;
  await supabaseServer
    .from("job_runs")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", jobRunId);
}

export async function POST(request: NextRequest) {
  // Security: Check worker secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let videoId: string | null = null;

  try {
    const job: ProcessVideoJob = await request.json();
    videoId = job.videoId;

    console.log(`[Worker:ProcessVideo] Starting processing for video ${videoId}`);

    // Fetch video data
    const { data: video, error: fetchError } = await supabaseServer
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    if (!video.source_url) {
      throw new Error("Video source_url is missing");
    }

    // ── Analysis-once guard (version-aware) ──
    const { data: existingInsight } = await supabaseServer
      .from("video_insights")
      .select("id, analysis_version, analysis_hash")
      .eq("video_id", videoId)
      .single();

    if (existingInsight && existingInsight.analysis_version === ANALYSIS_VERSION) {
      // Same version insight exists. Only proceed if this is an explicit re-run
      // (retry endpoint sets both processing_status and analysis_status to PENDING)
      const isExplicitRerun =
        video.analysis_status === "PENDING" && video.processing_status === "PENDING";

      if (!isExplicitRerun) {
        console.log(
          `[Worker:ProcessVideo] Insight v${ANALYSIS_VERSION} already exists for ${videoId}, skipping`
        );
        await supabaseServer
          .from("videos")
          .update({ processing_status: "DONE", processing_error: null })
          .eq("id", videoId);
        return NextResponse.json({
          success: true,
          videoId,
          skipped: true,
          message: "Insight already exists at current version",
        });
      }
    }

    // Insert job_run record
    const { data: jobRun } = await supabaseServer
      .from("job_runs")
      .insert({
        video_id: videoId,
        creator_id: video.creator_id,
        job_type: "PROCESS_VIDEO",
        status: "RUNNING",
        payload: job,
      })
      .select()
      .single();

    try {
      let transcript: string;
      let videoPath: string | undefined;

      // ── Skip re-download + re-transcription if transcript already exists ──
      // Saves Whisper credits on retries that failed during ANALYZING
      if (video.transcript && video.transcript.length > 0) {
        console.log(`[Worker:ProcessVideo] Reusing existing transcript (${video.transcript.length} chars)`);
        transcript = video.transcript;
      } else {
        // Step 1: Download video and extract audio
        await supabaseServer
          .from("videos")
          .update({ processing_status: "DOWNLOADING" })
          .eq("id", videoId);
        await updateJobStage(jobRun?.id, "DOWNLOADING");

        console.log(`[Worker:ProcessVideo] Downloading video from ${video.source_url}`);

        const downloaded = await downloadAndExtractAudio(video.source_url, videoId);
        videoPath = downloaded.videoPath;

        // Step 2: Transcribe audio
        await supabaseServer
          .from("videos")
          .update({ processing_status: "TRANSCRIBING" })
          .eq("id", videoId);
        await updateJobStage(jobRun?.id, "TRANSCRIBING");

        console.log(`[Worker:ProcessVideo] Transcribing audio...`);

        transcript = await transcribeAudio(downloaded.audioPath);

        // Save transcript immediately so retries can skip this step
        await supabaseServer
          .from("videos")
          .update({ transcript })
          .eq("id", videoId);

        console.log(`[Worker:ProcessVideo] Transcript: ${transcript.substring(0, 100)}...`);

        // Track Whisper usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabaseServer.rpc("increment_usage", {
          p_creator_id: video.creator_id,
          p_month: currentMonth,
          p_field: "whisper_calls",
          p_amount: 1,
        });
      }

      // Step 3: Extract keyframes (re-download video if we skipped it)
      await supabaseServer
        .from("videos")
        .update({ processing_status: "EXTRACTING_FRAMES" })
        .eq("id", videoId);
      await updateJobStage(jobRun?.id, "EXTRACTING_FRAMES");

      console.log(`[Worker:ProcessVideo] Extracting keyframes...`);

      let frameUrls: string[] = [];
      let framePaths: string[] = [];
      try {
        // If we skipped download, we need the video file for frame extraction
        if (!videoPath) {
          const downloaded = await downloadAndExtractAudio(video.source_url, videoId);
          videoPath = downloaded.videoPath;
        }

        const frames = await extractAndUploadFrames(
          videoPath,
          videoId,
          video.creator_id,
          video.duration_s
        );

        if (frames.length > 0) {
          const assetRows = frames.map((f) => ({
            video_id: videoId,
            asset_type: "FRAME" as const,
            storage_path: f.storagePath,
            public_url: f.publicUrl,
            meta: { index: f.index, timestamp: f.timestamp },
          }));

          // Use upsert to prevent duplicate frame assets on retry
          await supabaseServer
            .from("video_assets")
            .upsert(assetRows, { onConflict: "video_id,storage_path" });

          frameUrls = frames.map((f) => f.publicUrl);
          framePaths = frames.map((f) => f.storagePath);
          console.log(`[Worker:ProcessVideo] Stored ${frames.length} frames`);

          // Track frame extraction usage
          const frameMonth = new Date().toISOString().slice(0, 7);
          await supabaseServer.rpc("increment_usage", {
            p_creator_id: video.creator_id,
            p_month: frameMonth,
            p_field: "frames_extracted",
            p_amount: frames.length,
          });
        }
      } catch (frameError) {
        // Frame extraction failure is non-fatal; continue with text-only analysis
        console.warn(`[Worker:ProcessVideo] Frame extraction failed (non-fatal):`, frameError);
      }

      // ── Compute analysis hash and check for redundant LLM call ──
      const currentHash = computeAnalysisHash(transcript, video.caption, framePaths);

      if (
        existingInsight &&
        existingInsight.analysis_hash === currentHash &&
        existingInsight.analysis_version === ANALYSIS_VERSION
      ) {
        console.log(
          `[Worker:ProcessVideo] Analysis hash unchanged for ${videoId}, skipping LLM call`
        );
        await supabaseServer
          .from("videos")
          .update({
            processing_status: "DONE",
            processing_error: null,
            analysis_status: "DONE",
            analysis_hash: currentHash,
            analysis_version: ANALYSIS_VERSION,
          })
          .eq("id", videoId);

        if (jobRun) {
          await supabaseServer
            .from("job_runs")
            .update({ status: "DONE", updated_at: new Date().toISOString() })
            .eq("id", jobRun.id);
        }
        await cleanupTempFiles(videoId);

        return NextResponse.json({ success: true, videoId, skipped: true, reason: "hash_match" });
      }

      // Step 4: Generate insights (multimodal if frames available)
      await supabaseServer
        .from("videos")
        .update({ processing_status: "ANALYZING", analysis_status: "RUNNING" })
        .eq("id", videoId);
      await updateJobStage(jobRun?.id, "ANALYZING");

      console.log(
        `[Worker:ProcessVideo] Generating insights (${frameUrls.length > 0 ? "multimodal" : "text-only"})...`
      );

      let insights;
      const videoMeta = {
        caption: video.caption,
        duration_s: video.duration_s,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
      };

      if (frameUrls.length > 0) {
        insights = await generateMultimodalInsights(transcript, frameUrls, videoMeta);
      } else {
        const textInsights = await generateInsights(transcript, {
          duration_s: video.duration_s,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
        });
        insights = { ...textInsights, visual_notes: undefined };
      }

      // Step 5: Save insights with version + hash
      const { error: insightError } = await supabaseServer
        .from("video_insights")
        .upsert(
          {
            video_id: videoId,
            verdict: insights.verdict,
            why_json: insights.why,
            next_action: insights.next_action,
            labels_json: insights.labels,
            visual_notes_json: insights.visual_notes || null,
            cta_analysis_json: insights.cta_analysis || null,
            analysis_version: ANALYSIS_VERSION,
            analysis_hash: currentHash,
          },
          { onConflict: "video_id" }
        );

      if (insightError) {
        throw new Error(`Failed to save insights: ${insightError.message}`);
      }

      // Track LLM usage
      const llmMonth = new Date().toISOString().slice(0, 7);
      await supabaseServer.rpc("increment_usage", {
        p_creator_id: video.creator_id,
        p_month: llmMonth,
        p_field: "llm_calls",
        p_amount: 1,
      });
      await supabaseServer.rpc("increment_usage", {
        p_creator_id: video.creator_id,
        p_month: llmMonth,
        p_field: "videos_analyzed",
        p_amount: 1,
      });

      // Step 6: Mark as done
      await supabaseServer
        .from("videos")
        .update({
          processing_status: "DONE",
          processing_error: null,
          analysis_status: "DONE",
          analysis_version: ANALYSIS_VERSION,
          analysis_hash: currentHash,
        })
        .eq("id", videoId);

      console.log(`[Worker:ProcessVideo] Processing complete for video ${videoId}`);

      // Auto-trigger dashboard cache when reaching 5 analyzed videos
      try {
        const { count: doneCount } = await supabaseServer
          .from("videos")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", video.creator_id)
          .eq("processing_status", "DONE");

        const { data: existingCache } = await supabaseServer
          .from("creator_cached_dashboard")
          .select("computed_at")
          .eq("creator_id", video.creator_id)
          .single();

        if ((doneCount || 0) >= 5 && !existingCache) {
          console.log(
            `[Worker:ProcessVideo] Auto-computing dashboard cache for creator ${video.creator_id} (${doneCount} videos done)`
          );
          const { computeDashboardCache } = await import("@/lib/computeDashboard");
          const cache = await computeDashboardCache(video.creator_id);
          await supabaseServer
            .from("creator_cached_dashboard")
            .upsert(
              {
                creator_id: video.creator_id,
                cache_json: cache,
                computed_at: cache.computedAt,
              },
              { onConflict: "creator_id" }
            );
          console.log(`[Worker:ProcessVideo] Dashboard cache auto-computed for creator ${video.creator_id}`);
        }
      } catch (cacheError) {
        console.warn("[Worker:ProcessVideo] Auto-cache computation failed (non-fatal):", cacheError);
      }

      // Cleanup temp files
      await cleanupTempFiles(videoId);

      // Mark job as done
      if (jobRun) {
        await supabaseServer
          .from("job_runs")
          .update({
            status: "DONE",
            stage: "DONE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRun.id);
      }

      return NextResponse.json({
        success: true,
        videoId,
        verdict: insights.verdict,
        transcriptLength: transcript.length,
        framesExtracted: frameUrls.length,
        multimodal: frameUrls.length > 0,
        analysisVersion: ANALYSIS_VERSION,
        analysisHash: currentHash,
      });
    } catch (error) {
      // Mark video as failed
      await supabaseServer
        .from("videos")
        .update({
          processing_status: "FAILED",
          processing_error: error instanceof Error ? error.message : "Unknown error",
          analysis_status: "FAILED",
        })
        .eq("id", videoId);

      // Mark job as failed
      if (jobRun) {
        await supabaseServer
          .from("job_runs")
          .update({
            status: "FAILED",
            error_message: error instanceof Error ? error.message : "Unknown error",
            attempts: (jobRun.attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRun.id);
      }

      // Cleanup temp files even on error
      if (videoId) {
        await cleanupTempFiles(videoId);
      }

      throw error;
    }
  } catch (error) {
    console.error("[Worker:ProcessVideo] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Processing failed",
        videoId,
      },
      { status: 500 }
    );
  }
}
