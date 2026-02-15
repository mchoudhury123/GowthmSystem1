import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch video with its insight
    const { data: video, error: videoError } = await supabaseServer
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Fetch insight if it exists
    const { data: insight } = await supabaseServer
      .from("video_insights")
      .select("*")
      .eq("video_id", id)
      .single();

    const result = {
      ...video,
      insight: insight
        ? {
            id: insight.id,
            video_id: insight.video_id,
            verdict: insight.verdict,
            why: insight.why_json,
            next_action: insight.next_action,
            labels: insight.labels_json,
            visual_notes: insight.visual_notes_json || null,
            created_at: insight.created_at,
          }
        : null,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}
