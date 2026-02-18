import { supabaseServer } from "./supabaseServer";
import type { WeeklySnapshotData, WeeklyDeltas, DriftFlag } from "./types";

interface WeeklySnapshotResult {
  snapshot: WeeklySnapshotData;
  deltas: WeeklyDeltas;
  driftFlags: DriftFlag[];
  insightBullets: string[];
  recommendation: string;
  doMore: string[];
  stopDoing: string[];
}

/**
 * Compute and store a weekly snapshot for a creator.
 * Fetches videos from the last 7 days, computes metrics,
 * compares to the previous week, and generates drift flags + insights.
 */
export async function computeAndStoreWeeklySnapshot(
  creatorId: string
): Promise<void> {
  const today = new Date();
  const weekStart = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const sevenDaysAgo = new Date(
    today.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1. Fetch this week's DONE videos
  const { data: videos } = await supabaseServer
    .from("videos")
    .select("id, views, likes, comments, duration_s, created_at_ts")
    .eq("creator_id", creatorId)
    .eq("processing_status", "DONE")
    .gte("created_at_ts", sevenDaysAgo);

  if (!videos || videos.length === 0) {
    // Still store a zero-snapshot so drift detection can fire on cadence drop
    const zeroSnapshot: WeeklySnapshotData = {
      avg_duration_s: 0,
      avg_like_rate: 0,
      hook_distribution: {},
      format_distribution: {},
      cta_timing_distribution: {},
      cta_success_rate: 0,
      posting_cadence: 0,
      video_count: 0,
      total_views: 0,
      total_likes: 0,
    };

    const prev = await fetchPreviousSnapshot(creatorId);
    const deltas = computeDeltas(zeroSnapshot, prev);
    const driftFlags = detectDriftFlags(zeroSnapshot, prev, deltas);
    const insightBullets = generateInsightBullets(zeroSnapshot, deltas);
    const recommendation = generateRecommendation(
      zeroSnapshot,
      deltas,
      driftFlags,
      null
    );

    await storeSnapshot(creatorId, weekStart, zeroSnapshot, deltas, driftFlags, insightBullets, recommendation);
    return;
  }

  // 2. Fetch insights for these videos
  const videoIds = videos.map((v: any) => v.id);
  const { data: insights } = await supabaseServer
    .from("video_insights")
    .select("video_id, verdict, labels_json, cta_analysis_json")
    .in("video_id", videoIds);

  const insightMap: Record<string, any> = {};
  for (const ins of insights || []) {
    insightMap[ins.video_id] = ins;
  }

  // 3. Compute snapshot metrics
  const snapshot = computeSnapshot(videos, insightMap);

  // 4. Fetch previous week's snapshot
  const prev = await fetchPreviousSnapshot(creatorId);

  // 5. Compute deltas
  const deltas = computeDeltas(snapshot, prev);

  // 6. Detect drift flags
  const driftFlags = detectDriftFlags(snapshot, prev, deltas);

  // 7. Generate insight bullets
  const insightBullets = generateInsightBullets(snapshot, deltas);

  // 8. Find top hook type from all-time REPEAT videos for recommendation context
  const topRepeatHook = await fetchTopRepeatHookType(creatorId);

  // 9. Generate recommendation
  const recommendation = generateRecommendation(snapshot, deltas, driftFlags, topRepeatHook);

  // 10. Generate do_more / stop_doing from this week's insights
  const { doMore, stopDoing } = generateDoMoreStopDoing(insights || []);

  // 11. Store
  await storeSnapshot(
    creatorId, weekStart, snapshot, deltas, driftFlags,
    insightBullets, recommendation, doMore, stopDoing
  );
}

function computeSnapshot(
  videos: any[],
  insightMap: Record<string, any>
): WeeklySnapshotData {
  const totalViews = videos.reduce((s: number, v: any) => s + (v.views || 0), 0);
  const totalLikes = videos.reduce((s: number, v: any) => s + (v.likes || 0), 0);
  const totalDuration = videos.reduce((s: number, v: any) => s + (v.duration_s || 0), 0);

  const avgDuration = videos.length > 0 ? Math.round(totalDuration / videos.length) : 0;
  const avgLikeRate = totalViews > 0
    ? Math.round((totalLikes / totalViews) * 10000) / 100
    : 0;

  // Distributions
  const hookCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};
  const ctaCounts: Record<string, number> = {};
  let ctaWithRepeat = 0;
  let ctaTotal = 0;

  for (const v of videos) {
    const ins = insightMap[v.id];
    if (!ins) continue;

    const labels = ins.labels_json;
    if (labels?.hook_type) {
      hookCounts[labels.hook_type] = (hookCounts[labels.hook_type] || 0) + 1;
    }
    if (labels?.format) {
      formatCounts[labels.format] = (formatCounts[labels.format] || 0) + 1;
    }
    if (labels?.cta_timing) {
      ctaCounts[labels.cta_timing] = (ctaCounts[labels.cta_timing] || 0) + 1;
    }

    // CTA success rate
    const cta = ins.cta_analysis_json;
    if (cta?.cta_detected) {
      ctaTotal++;
      if (ins.verdict === "REPEAT") ctaWithRepeat++;
    }
  }

  const videosWithInsights = videos.filter((v: any) => insightMap[v.id]).length || 1;

  const toDistribution = (counts: Record<string, number>) => {
    const result: Record<string, number> = {};
    for (const [key, count] of Object.entries(counts)) {
      result[key] = Math.round((count / videosWithInsights) * 100);
    }
    return result;
  };

  return {
    avg_duration_s: avgDuration,
    avg_like_rate: avgLikeRate,
    hook_distribution: toDistribution(hookCounts),
    format_distribution: toDistribution(formatCounts),
    cta_timing_distribution: toDistribution(ctaCounts),
    cta_success_rate: ctaTotal > 0 ? Math.round((ctaWithRepeat / ctaTotal) * 100) : 0,
    posting_cadence: videos.length,
    video_count: videos.length,
    total_views: totalViews,
    total_likes: totalLikes,
  };
}

async function fetchPreviousSnapshot(
  creatorId: string
): Promise<WeeklySnapshotData | null> {
  const { data } = await supabaseServer
    .from("weekly_summary")
    .select("snapshot_json")
    .eq("creator_id", creatorId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();

  return data?.snapshot_json || null;
}

function computeDeltas(
  current: WeeklySnapshotData,
  previous: WeeklySnapshotData | null
): WeeklyDeltas {
  if (!previous) {
    return {
      avg_duration_s_pct: null,
      avg_like_rate_pct: null,
      posting_cadence_pct: null,
      total_views_pct: null,
      total_likes_pct: null,
    };
  }

  const pctChange = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr > 0 ? 100 : null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    avg_duration_s_pct: pctChange(current.avg_duration_s, previous.avg_duration_s),
    avg_like_rate_pct: pctChange(current.avg_like_rate, previous.avg_like_rate),
    posting_cadence_pct: pctChange(current.posting_cadence, previous.posting_cadence),
    total_views_pct: pctChange(current.total_views, previous.total_views),
    total_likes_pct: pctChange(current.total_likes, previous.total_likes),
  };
}

function detectDriftFlags(
  current: WeeklySnapshotData,
  previous: WeeklySnapshotData | null,
  deltas: WeeklyDeltas
): DriftFlag[] {
  const flags: DriftFlag[] = [];

  if (deltas.avg_duration_s_pct === null) return flags;

  // Length Drift: avg length up >20% AND performance down >15%
  if (
    deltas.avg_duration_s_pct > 20 &&
    deltas.avg_like_rate_pct !== null &&
    deltas.avg_like_rate_pct < -15
  ) {
    flags.push("Length Drift");
  }

  // Consistency Drop: posting cadence down >30%
  if (deltas.posting_cadence_pct !== null && deltas.posting_cadence_pct < -30) {
    flags.push("Consistency Drop");
  }

  // Hook Experimentation Phase: top hook type changed or share dropped >20pp
  if (previous) {
    const currTop = getTopKey(current.hook_distribution);
    const prevTop = getTopKey(previous.hook_distribution);

    if (currTop && prevTop) {
      if (currTop !== prevTop) {
        flags.push("Hook Experimentation Phase");
      } else {
        const currShare = current.hook_distribution[currTop] || 0;
        const prevShare = previous.hook_distribution[prevTop] || 0;
        if (prevShare - currShare > 20) {
          flags.push("Hook Experimentation Phase");
        }
      }
    }
  }

  return flags;
}

function getTopKey(distribution: Record<string, number>): string | null {
  let topKey: string | null = null;
  let topVal = -1;
  for (const [key, val] of Object.entries(distribution)) {
    if (val > topVal) {
      topVal = val;
      topKey = key;
    }
  }
  return topKey;
}

function generateInsightBullets(
  snapshot: WeeklySnapshotData,
  deltas: WeeklyDeltas
): string[] {
  const bullets: string[] = [];

  // 1. Performance bullet
  if (deltas.avg_like_rate_pct !== null) {
    const dir = deltas.avg_like_rate_pct >= 0 ? "increased" : "decreased";
    bullets.push(
      `Your like rate ${dir} ${Math.abs(deltas.avg_like_rate_pct)}% vs last week (now ${snapshot.avg_like_rate}%)`
    );
  } else {
    bullets.push(
      snapshot.avg_like_rate > 0
        ? `Your like rate is ${snapshot.avg_like_rate}% this week`
        : "No engagement data this week"
    );
  }

  // 2. Volume bullet
  if (snapshot.video_count === 0) {
    bullets.push("No new videos posted this week");
  } else if (deltas.posting_cadence_pct !== null) {
    const dir = deltas.posting_cadence_pct > 0 ? "up" : deltas.posting_cadence_pct < 0 ? "down" : "same as";
    bullets.push(
      `You posted ${snapshot.video_count} video${snapshot.video_count !== 1 ? "s" : ""} this week — ${dir}${deltas.posting_cadence_pct !== 0 ? ` ${Math.abs(deltas.posting_cadence_pct)}%` : ""} from last week`
    );
  } else {
    bullets.push(
      `You posted ${snapshot.video_count} video${snapshot.video_count !== 1 ? "s" : ""} this week`
    );
  }

  // 3. Content bullet — top hook type + format
  const topHook = getTopKey(snapshot.hook_distribution);
  const topFormat = getTopKey(snapshot.format_distribution);
  if (topHook && topFormat) {
    const hookPct = snapshot.hook_distribution[topHook];
    bullets.push(
      `${hookPct}% of your content used ${topHook.replace(/_/g, " ").toLowerCase()} hooks with ${topFormat.replace(/_/g, " ").toLowerCase()} format`
    );
  } else if (topHook) {
    const hookPct = snapshot.hook_distribution[topHook];
    bullets.push(
      `${hookPct}% of your content used ${topHook.replace(/_/g, " ").toLowerCase()} hooks`
    );
  } else {
    bullets.push("Not enough analyzed content to identify patterns yet");
  }

  return bullets;
}

function generateRecommendation(
  snapshot: WeeklySnapshotData,
  deltas: WeeklyDeltas,
  driftFlags: DriftFlag[],
  topRepeatHook: string | null
): string {
  // Priority 1: Address drift flags
  if (driftFlags.includes("Length Drift")) {
    return `Your videos are getting longer while performance drops — try trimming back to shorter formats`;
  }
  if (driftFlags.includes("Consistency Drop")) {
    return `Posting cadence dropped significantly — aim for at least ${Math.max(snapshot.posting_cadence + 2, 3)} videos next week to maintain momentum`;
  }
  if (driftFlags.includes("Hook Experimentation Phase")) {
    if (topRepeatHook) {
      return `You're experimenting with new hook types — ${topRepeatHook.replace(/_/g, " ").toLowerCase()} hooks have historically worked best for you`;
    }
    return "You're experimenting with new hook types — monitor performance closely and double down on what gets traction";
  }

  // Priority 2: React to performance trends
  if (deltas.avg_like_rate_pct !== null && deltas.avg_like_rate_pct > 10) {
    const topHook = getTopKey(snapshot.hook_distribution);
    const topFormat = getTopKey(snapshot.format_distribution);
    if (topHook && topFormat) {
      return `Keep the momentum: double down on ${topHook.replace(/_/g, " ").toLowerCase()} hooks + ${topFormat.replace(/_/g, " ").toLowerCase()} format`;
    }
    return "Performance is trending up — keep doing what you're doing";
  }

  if (deltas.avg_like_rate_pct !== null && deltas.avg_like_rate_pct < -10) {
    if (topRepeatHook) {
      return `Like rate is dipping — consider leaning back into ${topRepeatHook.replace(/_/g, " ").toLowerCase()} hooks which have driven your best results`;
    }
    return "Like rate is dipping — review your top-performing videos and replicate their structure";
  }

  // Priority 3: Default
  return `Stay consistent — post at least ${Math.max(snapshot.posting_cadence, 3)} videos next week`;
}

async function fetchTopRepeatHookType(creatorId: string): Promise<string | null> {
  const { data: videos } = await supabaseServer
    .from("videos")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("processing_status", "DONE");

  if (!videos || videos.length === 0) return null;

  const videoIds = videos.map((v: any) => v.id);
  const { data: repeatInsights } = await supabaseServer
    .from("video_insights")
    .select("labels_json")
    .in("video_id", videoIds)
    .eq("verdict", "REPEAT");

  if (!repeatInsights || repeatInsights.length === 0) return null;

  const hookCounts: Record<string, number> = {};
  for (const ins of repeatInsights) {
    const ht = (ins.labels_json as any)?.hook_type;
    if (ht) hookCounts[ht] = (hookCounts[ht] || 0) + 1;
  }

  return getTopKey(hookCounts);
}

function generateDoMoreStopDoing(insights: any[]): {
  doMore: string[];
  stopDoing: string[];
} {
  const repeatInsights = insights.filter((i: any) => i.verdict === "REPEAT");
  const stopInsights = insights.filter((i: any) => i.verdict === "STOP");

  const countLabels = (filtered: any[]) => {
    const counts: Record<string, number> = {};
    for (const ins of filtered) {
      const labels = ins.labels_json;
      if (!labels) continue;
      for (const [key, value] of Object.entries(labels)) {
        const label = `${key}:${value}`;
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    return counts;
  };

  const repeatCounts = countLabels(repeatInsights);
  const doMore = Object.entries(repeatCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 4)
    .map(([label, count]) => {
      const [key, value] = label.split(":");
      const pct = repeatInsights.length > 0
        ? Math.round(((count as number) / repeatInsights.length) * 100)
        : 0;
      return formatDoMore(key, value, pct, count as number);
    });

  const stopCounts = countLabels(stopInsights);
  const stopDoing = Object.entries(stopCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([label, count]) => {
      const [key, value] = label.split(":");
      return formatStopDoing(key, value, count as number);
    });

  return {
    doMore: doMore.length > 0 ? doMore : ["Keep creating content"],
    stopDoing,
  };
}

function formatDoMore(key: string, value: string, pct: number, count: number): string {
  const v = value.replace(/_/g, " ").toLowerCase();
  switch (key) {
    case "hook_type": return `${v} hooks — ${pct}% of your top performers use them`;
    case "format": return `${v} format — drives engagement (${count} winners)`;
    case "cta_timing": return `${v} CTAs — capture attention at peak (${count} videos)`;
    case "length_bucket": return `${value} second videos — sweet spot for retention (${count} hits)`;
    default: return `More ${v} — ${pct}% success rate`;
  }
}

function formatStopDoing(key: string, value: string, count: number): string {
  const v = value.replace(/_/g, " ").toLowerCase();
  switch (key) {
    case "hook_type": return `${v} hooks — underperform in your niche`;
    case "format": return `${v} content — low engagement (${count} flops)`;
    case "cta_timing": return `${v} CTAs — missing engagement window`;
    case "length_bucket": return `Videos over ${value}s — losing viewer attention`;
    default: return `Avoid ${v} — not resonating with audience`;
  }
}

async function storeSnapshot(
  creatorId: string,
  weekStart: string,
  snapshot: WeeklySnapshotData,
  deltas: WeeklyDeltas,
  driftFlags: DriftFlag[],
  insightBullets: string[],
  recommendation: string,
  doMore?: string[],
  stopDoing?: string[]
): Promise<void> {
  const row: Record<string, unknown> = {
    creator_id: creatorId,
    week_start: weekStart,
    snapshot_json: snapshot,
    deltas_json: deltas,
    drift_flags: driftFlags,
    insight_bullets: insightBullets,
    recommendation,
  };

  if (doMore) row.do_more_json = doMore;
  if (stopDoing) row.stop_doing_json = stopDoing.length > 0 ? stopDoing : [];

  // Use upsert on (creator_id, week_start) — safe to re-run
  const { error } = await supabaseServer
    .from("weekly_summary")
    .upsert(row, { onConflict: "creator_id,week_start" });

  if (error) {
    throw new Error(`Failed to store weekly snapshot: ${error.message}`);
  }
}
