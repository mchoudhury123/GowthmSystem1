import { supabaseServer } from "./supabaseServer";
import type { CachedDashboard, ConfidenceSnapshot, HookType, LengthBucket } from "./types";

export async function computeDashboardCache(creatorId: string): Promise<CachedDashboard> {
  // 1. Fetch profile
  const { data: profile } = await supabaseServer
    .from("creator_profile")
    .select("*")
    .eq("creator_id", creatorId)
    .single();

  // 2. Fetch time series (last 90 days)
  const { data: metrics } = await supabaseServer
    .from("creator_daily_metrics")
    .select("*")
    .eq("creator_id", creatorId)
    .order("day", { ascending: true })
    .limit(90);

  const days = (metrics || []).map((m: any) => m.day);
  const followers = (metrics || []).map((m: any) => m.follower_count);
  const totalLikesArr = (metrics || []).map((m: any) => Number(m.total_likes));

  // 3. Fetch all videos
  const { data: videos } = await supabaseServer
    .from("videos")
    .select("id, caption, views, likes, comments, duration_s, created_at_ts, processing_status")
    .eq("creator_id", creatorId);

  const videoIds = (videos || []).map((v: any) => v.id);

  // 4. Fetch all insights
  const { data: insights } = videoIds.length > 0
    ? await supabaseServer
        .from("video_insights")
        .select("*")
        .in("video_id", videoIds)
    : { data: [] };

  // Build insights lookup
  const insightMap: Record<string, any> = {};
  for (const ins of insights || []) {
    insightMap[ins.video_id] = ins;
  }

  // 5. Performance rollups
  const allViews = (videos || [])
    .map((v: any) => v.views)
    .filter((v: number) => v > 0)
    .sort((a: number, b: number) => a - b);

  const avgViews = allViews.length > 0
    ? Math.round(allViews.reduce((a: number, b: number) => a + b, 0) / allViews.length)
    : 0;
  const medianViews = allViews.length > 0
    ? allViews[Math.floor(allViews.length / 2)]
    : 0;

  const totalV = (videos || []).length;
  const totalLikesSum = (videos || []).reduce((a: number, v: any) => a + (v.likes || 0), 0);
  const totalViewsSum = (videos || []).reduce((a: number, v: any) => a + (v.views || 0), 0);
  const totalCommentsSum = (videos || []).reduce((a: number, v: any) => a + (v.comments || 0), 0);

  const likeRate = totalViewsSum > 0
    ? Math.round((totalLikesSum / totalViewsSum) * 10000) / 100
    : 0;
  const commentRate = totalViewsSum > 0
    ? Math.round((totalCommentsSum / totalViewsSum) * 10000) / 100
    : 0;

  // Posting cadence: videos per week over the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentVideos = (videos || []).filter(
    (v: any) => v.created_at_ts && v.created_at_ts >= thirtyDaysAgo
  );
  const postingCadence = Math.round((recentVideos.length / (30 / 7)) * 10) / 10;

  // 6. Verdict counts
  const verdictCounts = { REPEAT: 0, MODIFY: 0, STOP: 0 };
  for (const ins of insights || []) {
    if (ins.verdict in verdictCounts) {
      verdictCounts[ins.verdict as keyof typeof verdictCounts]++;
    }
  }

  // 6.5 Confidence Snapshot
  const doneVideos = (videos || []).filter((v: any) => v.processing_status === "DONE");
  const analyzedWithInsights = doneVideos
    .filter((v: any) => insightMap[v.id])
    .map((v: any) => ({
      ...v,
      insight: insightMap[v.id],
      videoLikeRate: v.views > 0 ? (v.likes / v.views) * 100 : 0,
    }));

  // Best hook type by avg like_rate
  let bestHookType: ConfidenceSnapshot["bestHookType"] = null;
  const hookGroups: Record<string, { totalRate: number; count: number }> = {};
  for (const v of analyzedWithInsights) {
    const ht = v.insight.labels_json?.hook_type;
    if (!ht) continue;
    if (!hookGroups[ht]) hookGroups[ht] = { totalRate: 0, count: 0 };
    hookGroups[ht].totalRate += v.videoLikeRate;
    hookGroups[ht].count += 1;
  }
  let bestHookAvg = -1;
  for (const [hookType, data] of Object.entries(hookGroups)) {
    const avg = data.count > 0 ? data.totalRate / data.count : 0;
    if (avg > bestHookAvg) {
      bestHookAvg = avg;
      bestHookType = {
        hookType: hookType as HookType,
        avgLikeRate: Math.round(avg * 100) / 100,
        videoCount: data.count,
      };
    }
  }

  // Best length bucket by avg like_rate
  let bestLengthBucket: ConfidenceSnapshot["bestLengthBucket"] = null;
  const bucketGroups: Record<string, { totalRate: number; count: number }> = {};
  for (const v of analyzedWithInsights) {
    const lb = v.insight.labels_json?.length_bucket;
    if (!lb) continue;
    if (!bucketGroups[lb]) bucketGroups[lb] = { totalRate: 0, count: 0 };
    bucketGroups[lb].totalRate += v.videoLikeRate;
    bucketGroups[lb].count += 1;
  }
  let bestBucketAvg = -1;
  for (const [bucket, data] of Object.entries(bucketGroups)) {
    const avg = data.count > 0 ? data.totalRate / data.count : 0;
    if (avg > bestBucketAvg) {
      bestBucketAvg = avg;
      bestLengthBucket = {
        lengthBucket: bucket as LengthBucket,
        avgLikeRate: Math.round(avg * 100) / 100,
        videoCount: data.count,
      };
    }
  }

  // Post This Next — cluster by (hook_type, length_bucket), pick highest avg like_rate
  let postThisNext: ConfidenceSnapshot["postThisNext"] = null;
  const clusterGroups: Record<string, { totalRate: number; count: number; bestVideo: any }> = {};
  for (const v of analyzedWithInsights) {
    const ht = v.insight.labels_json?.hook_type;
    const lb = v.insight.labels_json?.length_bucket;
    if (!ht || !lb) continue;
    const key = `${ht}|${lb}`;
    if (!clusterGroups[key]) {
      clusterGroups[key] = { totalRate: 0, count: 0, bestVideo: v };
    }
    clusterGroups[key].totalRate += v.videoLikeRate;
    clusterGroups[key].count += 1;
    if (v.videoLikeRate > (clusterGroups[key].bestVideo?.videoLikeRate || 0)) {
      clusterGroups[key].bestVideo = v;
    }
  }
  let bestClusterAvg = -1;
  for (const [key, data] of Object.entries(clusterGroups)) {
    const avg = data.count > 0 ? data.totalRate / data.count : 0;
    if (avg > bestClusterAvg) {
      bestClusterAvg = avg;
      const [hookType, lengthBucket] = key.split("|");
      postThisNext = {
        hookType: hookType as HookType,
        lengthBucket: lengthBucket as LengthBucket,
        avgLikeRate: Math.round(avg * 100) / 100,
        sampleCaption: data.bestVideo?.caption || "",
      };
    }
  }

  const confidenceSnapshot: ConfidenceSnapshot = {
    analyzedCount: doneVideos.length,
    totalVideosIngested: totalV,
    bestHookType,
    bestLengthBucket,
    postThisNext,
  };

  // 7. Count labels
  function countLabels(filteredInsights: any[]) {
    const counts: Record<string, number> = {};
    for (const ins of filteredInsights) {
      const labels = ins.labels_json || {};
      for (const [key, value] of Object.entries(labels)) {
        const label = `${key}:${value}`;
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    const total = filteredInsights.length || 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([label, count]) => ({
        label,
        count: count as number,
        percentage: Math.round(((count as number) / total) * 100),
      }));
  }

  const repeatInsights = (insights || []).filter((i: any) => i.verdict === "REPEAT");
  const stopInsights = (insights || []).filter((i: any) => i.verdict === "STOP");
  const topRepeatLabels = countLabels(repeatInsights);
  const topStopLabels = countLabels(stopInsights);

  // 8. "What to do next" from REPEAT video next_actions
  const repeatActions: Record<string, string[]> = {};
  for (const ins of repeatInsights) {
    const action = ins.next_action;
    if (!action) continue;
    if (!repeatActions[action]) repeatActions[action] = [];
    repeatActions[action].push(ins.video_id);
  }
  const whatToDoNext = Object.entries(repeatActions)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 3)
    .map(([action, ids]) => ({ action, exampleVideoIds: ids.slice(0, 3) }));

  // 9. "What to stop" from STOP video next_actions
  const stopActions: Record<string, string[]> = {};
  for (const ins of stopInsights) {
    const action = ins.next_action;
    if (!action) continue;
    if (!stopActions[action]) stopActions[action] = [];
    stopActions[action].push(ins.video_id);
  }
  const whatToStop = Object.entries(stopActions)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 3)
    .map(([action, ids]) => ({ action, exampleVideoIds: ids.slice(0, 3) }));

  return {
    profile: profile || null,
    timeSeries: { days, followers, totalLikes: totalLikesArr },
    performance: {
      avgViews,
      medianViews,
      likeRate,
      commentRate,
      postingCadence,
      totalVideos: totalV,
    },
    verdictCounts,
    topRepeatLabels,
    topStopLabels,
    whatToDoNext,
    whatToStop,
    confidenceSnapshot,
    computedAt: new Date().toISOString(),
  };
}
