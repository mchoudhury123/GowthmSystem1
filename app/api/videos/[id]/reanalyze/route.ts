import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getQueue, QUEUE_NAMES } from "@/lib/queue";
import { ANALYSIS_VERSION } from "@/lib/config";

/**
 * POST /api/videos/:id/reanalyze
 * Triggers re-analysis only if the video was analyzed with an older prompt version.
 * Does NOT delete frame assets (they are version-independent).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: video, error } = await supabaseServer
      .from("videos")
      .select("id, analysis_version, processing_status")
      .eq("id", id)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if ((video.analysis_version || 0) >= ANALYSIS_VERSION) {
      return NextResponse.json(
        {
          error: `Video already at analysis version ${ANALYSIS_VERSION}. No re-analysis needed.`,
        },
        { status: 400 }
      );
    }

    // Delete existing insight so it gets regenerated
    await supabaseServer
      .from("video_insights")
      .delete()
      .eq("video_id", id);

    // Mark for re-analysis (explicit re-run signal)
    await supabaseServer
      .from("videos")
      .update({
        processing_status: "PENDING",
        processing_error: null,
        analysis_status: "PENDING",
      })
      .eq("id", id);

    // Enqueue for processing
    const queue = getQueue();
    const jobId = await queue.enqueue(QUEUE_NAMES.PROCESS_VIDEO, { videoId: id });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Video queued for re-analysis (v${video.analysis_version || 0} → v${ANALYSIS_VERSION})`,
    });
  } catch (error) {
    console.error("[VideoReanalyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue re-analysis" },
      { status: 500 }
    );
  }
}
