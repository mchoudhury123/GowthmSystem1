import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { analyzeTranscript } from "@/lib/llm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { transcriptText } = body;

    if (!transcriptText) {
      return NextResponse.json(
        { error: "transcriptText is required" },
        { status: 400 }
      );
    }

    // Fetch video data
    const { data: video, error: videoError } = await supabaseServer
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Run analysis (uses mock if no API keys)
    const analysis = await analyzeTranscript(transcriptText, {
      duration_s: video.duration_s,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
    });

    // Check if insight already exists
    const { data: existingInsight } = await supabaseServer
      .from("video_insights")
      .select("id")
      .eq("video_id", id)
      .single();

    let insight;

    if (existingInsight) {
      // Update existing
      const { data, error } = await supabaseServer
        .from("video_insights")
        .update({
          verdict: analysis.verdict,
          why_json: analysis.why,
          next_action: analysis.next_action,
          labels_json: analysis.labels,
          cta_analysis_json: analysis.cta_analysis || null,
        })
        .eq("video_id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      insight = data;
    } else {
      // Insert new
      const { data, error } = await supabaseServer
        .from("video_insights")
        .insert([
          {
            video_id: id,
            verdict: analysis.verdict,
            why_json: analysis.why,
            next_action: analysis.next_action,
            labels_json: analysis.labels,
            cta_analysis_json: analysis.cta_analysis || null,
          },
        ])
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      insight = data;
    }

    return NextResponse.json({
      success: true,
      insight: {
        ...insight,
        why: insight.why_json,
        labels: insight.labels_json,
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to run analysis" },
      { status: 500 }
    );
  }
}
