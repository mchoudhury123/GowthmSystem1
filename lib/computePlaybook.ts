import { supabaseServer } from "./supabaseServer";
import { PLAYBOOK_DEBOUNCE_HOURS } from "./config";
import type { ExperimentStatus } from "./types";

/**
 * Compute and store the creator's dominant winning content cluster.
 * Groups all DONE videos by (hook_type, format, length_bucket, cta_timing),
 * picks the highest-performing cluster with >= 3 videos,
 * and detects if the creator is experimenting with new patterns.
 *
 * Debounced: skips if computed within PLAYBOOK_DEBOUNCE_HOURS.
 */
export async function computeCreatorPlaybook(
  creatorId: string
): Promise<void> {
  // 1. Debounce check
  const { data: existing } = await supabaseServer
    .from("creator_playbook")
    .select("computed_at")
    .eq("creator_id", creatorId)
    .single();

  if (existing?.computed_at) {
    const hoursSince =
      (Date.now() - new Date(existing.computed_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < PLAYBOOK_DEBOUNCE_HOURS) {
      console.log(
        `[Playbook] Skipping ${creatorId} — computed ${hoursSince.toFixed(1)}h ago (debounce: ${PLAYBOOK_DEBOUNCE_HOURS}h)`
      );
      return;
    }
  }

  // 2. Fetch all DONE videos
  const { data: videos } = await supabaseServer
    .from("videos")
    .select("id, views, likes, created_at_ts")
    .eq("creator_id", creatorId)
    .eq("processing_status", "DONE");

  if (!videos || videos.length === 0) {
    console.log(`[Playbook] No DONE videos for ${creatorId}, skipping`);
    return;
  }

  // 3. Fetch insights for these videos
  const videoIds = videos.map((v: any) => v.id);
  const { data: insights } = await supabaseServer
    .from("video_insights")
    .select("video_id, verdict, labels_json, cta_analysis_json")
    .in("video_id", videoIds);

  if (!insights || insights.length === 0) {
    console.log(`[Playbook] No insights for ${creatorId}, skipping`);
    return;
  }

  const insightMap: Record<string, any> = {};
  for (const ins of insights) {
    insightMap[ins.video_id] = ins;
  }

  // 4. Compute creator median like_rate
  const rates = videos
    .filter((v: any) => v.views > 0)
    .map((v: any) => (v.likes / v.views) * 100)
    .sort((a: number, b: number) => a - b);

  if (rates.length === 0) {
    console.log(`[Playbook] No videos with views for ${creatorId}, skipping`);
    return;
  }

  const medianLikeRate = rates[Math.floor(rates.length / 2)];

  // 5. Build 4-dimensional clusters
  const clusters: Record<
    string,
    { totalRate: number; count: number; hookType: string; format: string; lengthBucket: string; ctaTiming: string }
  > = {};

  for (const v of videos) {
    const ins = insightMap[v.id];
    if (!ins || v.views <= 0) continue;

    const labels = ins.labels_json;
    if (!labels?.hook_type || !labels?.format || !labels?.length_bucket || !labels?.cta_timing) continue;

    const key = `${labels.hook_type}|${labels.format}|${labels.length_bucket}|${labels.cta_timing}`;
    const likeRate = (v.likes / v.views) * 100;

    if (!clusters[key]) {
      clusters[key] = {
        totalRate: 0,
        count: 0,
        hookType: labels.hook_type,
        format: labels.format,
        lengthBucket: labels.length_bucket,
        ctaTiming: labels.cta_timing,
      };
    }
    clusters[key].totalRate += likeRate;
    clusters[key].count += 1;
  }

  // 6. Pick winning cluster (>= 3 videos, highest avg like_rate)
  let bestCluster: (typeof clusters)[string] | null = null;
  let bestAvg = -1;

  for (const cluster of Object.values(clusters)) {
    if (cluster.count < 3) continue;
    const avg = cluster.totalRate / cluster.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestCluster = cluster;
    }
  }

  if (!bestCluster) {
    console.log(
      `[Playbook] No cluster with >= 3 videos for ${creatorId}, skipping`
    );
    return;
  }

  const clusterAvgRate = Math.round((bestCluster.totalRate / bestCluster.count) * 100) / 100;
  const performanceDelta =
    medianLikeRate > 0
      ? Math.round(((clusterAvgRate - medianLikeRate) / medianLikeRate) * 1000) / 10
      : 0;

  // 7. Experiment detection — check latest 5 videos
  const sortedVideos = [...videos]
    .filter((v: any) => insightMap[v.id])
    .sort((a: any, b: any) => {
      const aTime = a.created_at_ts || a.id;
      const bTime = b.created_at_ts || b.id;
      return bTime > aTime ? 1 : -1;
    })
    .slice(0, 5);

  let experimentStatus: ExperimentStatus = "Stable";

  if (sortedVideos.length >= 3) {
    let differentHookCount = 0;
    let differentFormatCount = 0;

    for (const v of sortedVideos) {
      const labels = insightMap[v.id]?.labels_json;
      if (!labels) continue;
      if (labels.hook_type !== bestCluster.hookType) differentHookCount++;
      if (labels.format !== bestCluster.format) differentFormatCount++;
    }

    if (differentHookCount >= 3) {
      experimentStatus = "Testing New Hook";
    } else if (differentFormatCount >= 3) {
      experimentStatus = "Testing New Format";
    }
  }

  // 8. Upsert
  const { error } = await supabaseServer
    .from("creator_playbook")
    .upsert(
      {
        creator_id: creatorId,
        dominant_hook_type: bestCluster.hookType,
        dominant_format: bestCluster.format,
        dominant_length_bucket: bestCluster.lengthBucket,
        dominant_cta_window: bestCluster.ctaTiming,
        supporting_video_count: bestCluster.count,
        avg_like_rate: clusterAvgRate,
        median_like_rate: Math.round(medianLikeRate * 100) / 100,
        performance_delta_percent: performanceDelta,
        experiment_status: experimentStatus,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "creator_id" }
    );

  if (error) {
    throw new Error(`Failed to upsert creator playbook: ${error.message}`);
  }

  console.log(
    `[Playbook] Computed for ${creatorId}: ${bestCluster.hookType}|${bestCluster.format}|${bestCluster.lengthBucket}|${bestCluster.ctaTiming} (${bestCluster.count} videos, +${performanceDelta}% vs baseline, ${experimentStatus})`
  );

  // Chain: compute "Post This Next" recommendation
  try {
    const { computeNextPostRecommendation } = await import("./computeNextPost");
    await computeNextPostRecommendation(creatorId);
  } catch (nextPostError) {
    console.warn(`[Playbook] Next post computation failed (non-fatal):`, nextPostError);
  }
}
