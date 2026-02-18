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

    // Fetch latest weekly summary (now supports multiple per creator, one per week)
    const { data: weekly_summary } = await supabaseServer
      .from("weekly_summary")
      .select("*")
      .eq("creator_id", id)
      .order("week_start", { ascending: false, nullsFirst: false })
      .limit(1)
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
        recommendations: insight.recommendations_json || null,
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

    // Global analysis progress (counts across ALL videos, not just top 30)
    const { count: globalDoneCount } = await supabaseServer
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", id)
      .eq("processing_status", "DONE");

    const { count: globalTotalCount } = await supabaseServer
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", id);

    const analysis_progress = {
      analyzed_count: globalDoneCount || 0,
      total_ingested: globalTotalCount || 0,
      analysis_ready: (globalDoneCount || 0) >= 5,
    };

    // Fetch cached dashboard
    const { data: cachedDashboard } = await supabaseServer
      .from("creator_cached_dashboard")
      .select("cache_json, computed_at")
      .eq("creator_id", id)
      .single();

    // Fetch creator playbook
    const { data: playbook } = await supabaseServer
      .from("creator_playbook")
      .select("*")
      .eq("creator_id", id)
      .single();

    // Fetch next post recommendation
    const { data: nextPost } = await supabaseServer
      .from("creator_next_post")
      .select("*")
      .eq("creator_id", id)
      .single();

    // Detect new insights since last login
    const lastLogin = creator.last_login_at
      ? new Date(creator.last_login_at)
      : null;
    const latestSnapshotAt = weekly_summary?.created_at
      ? new Date(weekly_summary.created_at)
      : null;
    const hasNewInsights =
      !!latestSnapshotAt &&
      !!weekly_summary?.snapshot_json &&
      (!lastLogin || latestSnapshotAt > lastLogin);

    // Count new insight bullets for the banner message
    const newInsightCount = hasNewInsights
      ? weekly_summary?.insight_bullets?.length || 3
      : 0;

    return NextResponse.json({
      creator,
      creator_profile: creatorProfile || null,
      weekly_summary: weekly_summary
        ? {
            ...weekly_summary,
            do_more: weekly_summary.do_more_json,
            stop_doing: weekly_summary.stop_doing_json,
            snapshot: weekly_summary.snapshot_json || null,
            deltas: weekly_summary.deltas_json || null,
            drift_flags: weekly_summary.drift_flags || [],
            insight_bullets: weekly_summary.insight_bullets || [],
            recommendation: weekly_summary.recommendation || null,
          }
        : null,
      recent_videos,
      processing_stats,
      analysis_progress,
      cached_dashboard: cachedDashboard?.cache_json || null,
      playbook: playbook || null,
      next_post: nextPost || null,
      has_new_insights: hasNewInsights,
      new_insight_count: newInsightCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
