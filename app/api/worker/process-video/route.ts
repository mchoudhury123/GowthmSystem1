import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { downloadAndExtractAudio, cleanupTempFiles } from "@/lib/videoProcessing";
import { transcribeAudio } from "@/lib/transcription";
import { generateInsights, generateMultimodalInsights } from "@/lib/insights";
import { extractAndUploadFrames } from "@/lib/frameExtraction";
import type { ProcessVideoJob } from "@/lib/queue";

const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-change-in-production";

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

    // Check if insight already exists (never re-analyze automatically)
    const { data: existingInsight } = await supabaseServer
      .from("video_insights")
      .select("id")
      .eq("video_id", videoId)
      .single();

    if (existingInsight) {
      console.log(`[Worker:ProcessVideo] Insight already exists for ${videoId}, skipping`);
      await supabaseServer
        .from("videos")
        .update({ processing_status: "DONE", processing_error: null })
        .eq("id", videoId);
      return NextResponse.json({
        success: true,
        videoId,
        skipped: true,
        message: "Insight already exists",
      });
    }

    // Update job_runs
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
      // Step 1: Download video and extract audio
      await supabaseServer
        .from("videos")
        .update({ processing_status: "DOWNLOADING" })
        .eq("id", videoId);

      console.log(`[Worker:ProcessVideo] Downloading video from ${video.source_url}`);

      const { videoPath, audioPath } = await downloadAndExtractAudio(video.source_url, videoId);

      // Step 2: Transcribe audio
      await supabaseServer
        .from("videos")
        .update({ processing_status: "TRANSCRIBING" })
        .eq("id", videoId);

      console.log(`[Worker:ProcessVideo] Transcribing audio...`);

      const transcript = await transcribeAudio(audioPath);

      // Save transcript
      await supabaseServer
        .from("videos")
        .update({ transcript })
        .eq("id", videoId);

      console.log(`[Worker:ProcessVideo] Transcript: ${transcript.substring(0, 100)}...`);

      // Step 3: Extract keyframes
      await supabaseServer
        .from("videos")
        .update({ processing_status: "EXTRACTING_FRAMES" })
        .eq("id", videoId);

      console.log(`[Worker:ProcessVideo] Extracting keyframes...`);

      let frameUrls: string[] = [];
      try {
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

          await supabaseServer.from("video_assets").insert(assetRows);
          frameUrls = frames.map((f) => f.publicUrl);
          console.log(`[Worker:ProcessVideo] Stored ${frames.length} frames`);
        }
      } catch (frameError) {
        // Frame extraction failure is non-fatal; continue with text-only analysis
        console.warn(`[Worker:ProcessVideo] Frame extraction failed (non-fatal):`, frameError);
      }

      // Step 4: Generate insights (multimodal if frames available)
      await supabaseServer
        .from("videos")
        .update({ processing_status: "ANALYZING" })
        .eq("id", videoId);

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

      // Step 5: Save insights
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
          },
          { onConflict: "video_id" }
        );

      if (insightError) {
        throw new Error(`Failed to save insights: ${insightError.message}`);
      }

      // Step 6: Mark as done
      await supabaseServer
        .from("videos")
        .update({
          processing_status: "DONE",
          processing_error: null,
        })
        .eq("id", videoId);

      console.log(`[Worker:ProcessVideo] Processing complete for video ${videoId}`);

      // Cleanup temp files
      await cleanupTempFiles(videoId);

      // Mark job as done
      if (jobRun) {
        await supabaseServer
          .from("job_runs")
          .update({
            status: "DONE",
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
      });
    } catch (error) {
      // Mark video as failed
      await supabaseServer
        .from("videos")
        .update({
          processing_status: "FAILED",
          processing_error: error instanceof Error ? error.message : "Unknown error",
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
