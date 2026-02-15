import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch all videos with insights for this creator
    const { data: videos, error: videosError } = await supabaseServer
      .from("videos")
      .select(
        `
        *,
        insight:video_insights(*)
      `
      )
      .eq("creator_id", id)
      .not("insight", "is", null);

    if (videosError) {
      return NextResponse.json({ error: videosError.message }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: "No analyzed videos found for this creator" },
        { status: 400 }
      );
    }

    // Simple deterministic logic to generate weekly summary
    const repeatVideos = videos.filter((v: any) => v.insight?.verdict === "REPEAT");
    const stopVideos = videos.filter((v: any) => v.insight?.verdict === "STOP");

    // Count label occurrences in REPEAT videos
    const labelCounts: Record<string, number> = {};

    repeatVideos.forEach((v: any) => {
      const labels = v.insight?.labels_json || v.insight?.labels;
      if (labels) {
        Object.entries(labels).forEach(([key, value]) => {
          const labelKey = `${key}:${value}`;
          labelCounts[labelKey] = (labelCounts[labelKey] || 0) + 1;
        });
      }
    });

    // Get top 3-4 patterns
    const topLabels = Object.entries(labelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    const doMore = topLabels.map(([label, count]) => {
      const [key, value] = label.split(":");
      const percentage = Math.round((count / repeatVideos.length) * 100);
      return formatDoMoreItem(key, value, percentage, count);
    });

    // Generate stop_doing from STOP videos
    const stopLabelCounts: Record<string, number> = {};

    stopVideos.forEach((v: any) => {
      const labels = v.insight?.labels_json || v.insight?.labels;
      if (labels) {
        Object.entries(labels).forEach(([key, value]) => {
          const labelKey = `${key}:${value}`;
          stopLabelCounts[labelKey] = (stopLabelCounts[labelKey] || 0) + 1;
        });
      }
    });

    const topStopLabels = Object.entries(stopLabelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const stopDoing = topStopLabels.map(([label, count]) => {
      const [key, value] = label.split(":");
      return formatStopDoingItem(key, value, count);
    });

    // Upsert weekly summary
    const { data: existing } = await supabaseServer
      .from("weekly_summary")
      .select("id")
      .eq("creator_id", id)
      .single();

    let summary;

    if (existing) {
      const { data, error } = await supabaseServer
        .from("weekly_summary")
        .update({
          do_more_json: doMore.length > 0 ? doMore : ["Keep creating content"],
          stop_doing_json: stopDoing.length > 0 ? stopDoing : [],
        })
        .eq("creator_id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      summary = data;
    } else {
      const { data, error } = await supabaseServer
        .from("weekly_summary")
        .insert([
          {
            creator_id: id,
            do_more_json: doMore.length > 0 ? doMore : ["Keep creating content"],
            stop_doing_json: stopDoing.length > 0 ? stopDoing : [],
          },
        ])
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      summary = data;
    }

    return NextResponse.json({
      success: true,
      summary: {
        ...summary,
        do_more: summary.do_more_json,
        stop_doing: summary.stop_doing_json,
      },
    });
  } catch (error) {
    console.error("Weekly summary generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly summary" },
      { status: 500 }
    );
  }
}

function formatDoMoreItem(
  key: string,
  value: string,
  percentage: number,
  count: number
): string {
  const valueFormatted = value.replace(/_/g, " ").toLowerCase();

  switch (key) {
    case "hook_type":
      return `${valueFormatted} hooks - ${percentage}% of your top performers use them`;
    case "format":
      return `${valueFormatted} format - drives authentic connection (${count} winners)`;
    case "cta_timing":
      return `${valueFormatted} CTAs - capture attention at peak (${count} videos)`;
    case "length_bucket":
      return `${value} second videos - sweet spot for retention (${count} hits)`;
    default:
      return `More ${valueFormatted} - ${percentage}% success rate`;
  }
}

function formatStopDoingItem(key: string, value: string, count: number): string {
  const valueFormatted = value.replace(/_/g, " ").toLowerCase();

  switch (key) {
    case "hook_type":
      return `${valueFormatted} hooks - underperform in your niche`;
    case "format":
      return `${valueFormatted} content - low engagement (${count} flops)`;
    case "cta_timing":
      return `${valueFormatted} CTAs - missing engagement window`;
    case "length_bucket":
      return `Videos over ${value}s - losing viewer attention`;
    default:
      return `Avoid ${valueFormatted} - not resonating with audience`;
  }
}
