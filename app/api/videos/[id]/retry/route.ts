import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getQueue, QUEUE_NAMES } from "@/lib/queue";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Reset video status to PENDING (only if currently FAILED)
    // Setting analysis_status = PENDING signals an explicit re-run to the worker
    const { data: video, error } = await supabaseServer
      .from("videos")
      .update({
        processing_status: "PENDING",
        processing_error: null,
        analysis_status: "PENDING",
      })
      .eq("id", id)
      .eq("processing_status", "FAILED")
      .select("id")
      .single();

    if (error || !video) {
      return NextResponse.json(
        { error: "Video not found or not in FAILED state" },
        { status: 400 }
      );
    }

    // Delete existing insight so it gets re-analyzed
    await supabaseServer
      .from("video_insights")
      .delete()
      .eq("video_id", id);

    // Delete existing frame assets so they get re-extracted
    await supabaseServer
      .from("video_assets")
      .delete()
      .eq("video_id", id);

    // Enqueue for reprocessing
    const queue = getQueue();
    await queue.enqueue(QUEUE_NAMES.PROCESS_VIDEO, { videoId: id });

    return NextResponse.json({ success: true, message: "Video queued for retry" });
  } catch (error) {
    console.error("[VideoRetry] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry video" },
      { status: 500 }
    );
  }
}
