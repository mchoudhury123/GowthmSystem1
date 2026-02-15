import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch creator
    const { data: creator, error: creatorError } = await supabaseServer
      .from("creators")
      .select("*")
      .eq("id", id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Fetch creator profile
    const { data: creatorProfile } = await supabaseServer
      .from("creator_profile")
      .select("*")
      .eq("creator_id", id)
      .single();

    // Fetch weekly summary
    const { data: weekly_summary } = await supabaseServer
      .from("weekly_summary")
      .select("*")
      .eq("creator_id", id)
      .single();

    // Fetch videos ordered by actual TikTok post date (created_at_ts), not DB insert time
    const { data: videos, error: videosError } = await supabaseServer
      .from("videos")
      .select("*")
      .eq("creator_id", id)
      .order("created_at_ts", { ascending: false })
      .limit(30);

    if (videosError) {
      return NextResponse.json({ error: videosError.message }, { status: 500 });
    }

    // Fetch insights for these videos
    const videoIds = (videos || []).map((v: any) => v.id);
    const { data: insights } = videoIds.length > 0
      ? await supabaseServer
          .from("video_insights")
          .select("*")
          .in("video_id", videoIds)
      : { data: [] };

    // Build insights lookup
    const insightsByVideoId: Record<string, any> = {};
    for (const insight of insights || []) {
      insightsByVideoId[insight.video_id] = {
        id: insight.id,
        video_id: insight.video_id,
        verdict: insight.verdict,
        why: insight.why_json,
        next_action: insight.next_action,
        labels: insight.labels_json,
        visual_notes: insight.visual_notes_json || null,
        cta_analysis: insight.cta_analysis_json || null,
        created_at: insight.created_at,
      };
    }

    // Build recent_videos with insights attached
    const recent_videos = (videos || []).map((v: any) => ({
      id: v.id,
      creator_id: v.creator_id,
      tiktok_id: v.tiktok_id,
      caption: v.caption,
      thumb_url: v.thumb_url,
      duration_s: v.duration_s,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      source_url: v.source_url,
      processing_status: v.processing_status,
      processing_error: v.processing_error,
      transcript: v.transcript,
      created_at: v.created_at,
      created_at_ts: v.created_at_ts,
      insight: insightsByVideoId[v.id] || null,
    }));

    // Compute processing stats
    const processing_stats = {
      total: recent_videos.length,
      pending: recent_videos.filter((v: any) => v.processing_status === "PENDING").length,
      downloading: recent_videos.filter((v: any) => v.processing_status === "DOWNLOADING").length,
      transcribing: recent_videos.filter((v: any) => v.processing_status === "TRANSCRIBING").length,
      extracting_frames: recent_videos.filter((v: any) => v.processing_status === "EXTRACTING_FRAMES").length,
      analyzing: recent_videos.filter((v: any) => v.processing_status === "ANALYZING").length,
      done: recent_videos.filter((v: any) => v.processing_status === "DONE").length,
      failed: recent_videos.filter((v: any) => v.processing_status === "FAILED").length,
    };

    // Fetch cached dashboard
    const { data: cachedDashboard } = await supabaseServer
      .from("creator_cached_dashboard")
      .select("cache_json, computed_at")
      .eq("creator_id", id)
      .single();

    return NextResponse.json({
      creator,
      creator_profile: creatorProfile || null,
      weekly_summary,
      recent_videos,
      processing_stats,
      cached_dashboard: cachedDashboard?.cache_json || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
