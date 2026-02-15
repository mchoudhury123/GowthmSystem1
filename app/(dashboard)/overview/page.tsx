"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import IngestButton from "@/components/IngestButton";
import DevTools from "@/components/DevTools";
import FollowersChart from "@/components/charts/FollowersChart";
import VerdictChart from "@/components/charts/VerdictChart";
import CadenceChart from "@/components/charts/CadenceChart";
import LikeRateChart from "@/components/charts/LikeRateChart";
import { getActiveCreatorId } from "@/lib/creatorContext";
import { recomputeDashboardCache, retryFailedVideo } from "@/lib/api";

interface DashboardData {
  creator: any;
  creator_profile: any;
  weekly_summary: any;
  recent_videos: any[];
  processing_stats: {
    total: number;
    pending: number;
    downloading: number;
    transcribing: number;
    extracting_frames: number;
    analyzing: number;
    done: number;
    failed: number;
  };
  cached_dashboard: any;
}

export default function OverviewPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [retryingVideos, setRetryingVideos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = getActiveCreatorId();
    if (!id) {
      router.push("/connect");
      return;
    }
    setCreatorId(id);
  }, [router]);

  const fetchDashboard = async () => {
    if (!creatorId) return;
    try {
      const response = await fetch(`/api/creators/${creatorId}/dashboard`);
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard");
      }
      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (creatorId) fetchDashboard();
  }, [creatorId]);

  // Poll for updates when videos are processing
  useEffect(() => {
    if (!data?.processing_stats) return;

    const ps = data.processing_stats;
    const isProcessing =
      ps.pending > 0 ||
      ps.downloading > 0 ||
      ps.transcribing > 0 ||
      ps.extracting_frames > 0 ||
      ps.analyzing > 0;

    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, [data?.processing_stats]);

  const handleRecompute = async () => {
    if (!creatorId || recomputing) return;
    setRecomputing(true);
    try {
      await recomputeDashboardCache(creatorId);
      await fetchDashboard();
    } catch (err) {
      console.error("Failed to recompute:", err);
    } finally {
      setRecomputing(false);
    }
  };

  const handleRetry = async (videoId: string) => {
    setRetryingVideos((prev) => new Set(prev).add(videoId));
    try {
      await retryFailedVideo(videoId);
      await fetchDashboard();
    } catch (err) {
      console.error("Failed to retry:", err);
    } finally {
      setRetryingVideos((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  if (loading || !creatorId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/60">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-accent-red">{error || "No data available"}</div>
      </div>
    );
  }

  const { weekly_summary, recent_videos, processing_stats, cached_dashboard, creator_profile } = data;

  const videosWithInsights = recent_videos.filter((v) => v.insight);
  const verdictCounts = cached_dashboard?.verdictCounts || {
    REPEAT: videosWithInsights.filter((v) => v.insight?.verdict === "REPEAT").length,
    MODIFY: videosWithInsights.filter((v) => v.insight?.verdict === "MODIFY").length,
    STOP: videosWithInsights.filter((v) => v.insight?.verdict === "STOP").length,
  };

  const ps = processing_stats;
  const isProcessing =
    ps.pending > 0 ||
    ps.downloading > 0 ||
    ps.transcribing > 0 ||
    ps.extracting_frames > 0 ||
    ps.analyzing > 0;

  const perf = cached_dashboard?.performance;

  return (
    <div className="space-y-8">
      {/* Header with Ingest + Recompute Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Overview</h1>
          <p className="text-foreground/60">
            {creator_profile?.display_name
              ? `@${creator_profile.display_name}`
              : "Your content intelligence dashboard"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="px-4 py-2 bg-charcoal-light hover:bg-charcoal-lighter text-foreground/80 font-medium rounded-lg transition-colors border border-charcoal-lighter disabled:opacity-50"
          >
            {recomputing ? "Recomputing..." : "Recompute Dashboard"}
          </button>
          <IngestButton creatorId={creatorId} onSuccess={fetchDashboard} />
        </div>
      </div>

      {/* Processing Status Banner */}
      {isProcessing && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin text-2xl">&#9881;</div>
              <div>
                <p className="font-semibold text-foreground">Processing videos...</p>
                <p className="text-sm text-foreground/60 mt-1">
                  {ps.pending} pending · {ps.downloading} downloading ·{" "}
                  {ps.transcribing} transcribing · {ps.extracting_frames} extracting frames ·{" "}
                  {ps.analyzing} analyzing
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-foreground/60 mb-1">Videos Analyzed</p>
            <p className="text-3xl font-bold text-foreground">{ps.done}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-foreground/60 mb-1">Avg Views</p>
            <p className="text-3xl font-bold text-foreground">
              {perf?.avgViews
                ? perf.avgViews >= 1000000
                  ? `${(perf.avgViews / 1000000).toFixed(1)}M`
                  : perf.avgViews >= 1000
                    ? `${(perf.avgViews / 1000).toFixed(0)}K`
                    : perf.avgViews
                : "\u2014"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-foreground/60 mb-1">Like Rate</p>
            <p className="text-3xl font-bold text-gold">
              {perf?.likeRate ? `${perf.likeRate}%` : "\u2014"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-foreground/60 mb-1">Posts / Week</p>
            <p className="text-3xl font-bold text-foreground">
              {perf?.postingCadence ?? "\u2014"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Followers Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowersChart
              days={cached_dashboard?.timeSeries?.days || []}
              followers={cached_dashboard?.timeSeries?.followers || []}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verdict Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <VerdictChart verdictCounts={verdictCounts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Like Rate Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <LikeRateChart videos={recent_videos} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posting Cadence</CardTitle>
          </CardHeader>
          <CardContent>
            <CadenceChart videos={recent_videos} />
          </CardContent>
        </Card>
      </div>

      {/* Action Cards from cached dashboard */}
      {cached_dashboard?.whatToDoNext?.length > 0 || cached_dashboard?.whatToStop?.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cached_dashboard.whatToDoNext?.length > 0 && (
            <Card glow className="border-gold/30">
              <CardHeader>
                <CardTitle className="text-gold flex items-center gap-2">
                  What to Double Down On
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cached_dashboard.whatToDoNext.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-charcoal-light rounded-lg border border-gold/10"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-bold">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-foreground/90">{item.action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {cached_dashboard.whatToStop?.length > 0 && (
            <Card className="border-accent-red/30">
              <CardHeader>
                <CardTitle className="text-accent-red flex items-center gap-2">
                  Stop Doing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cached_dashboard.whatToStop.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-charcoal-light rounded-lg border border-accent-red/10"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-red/20 flex items-center justify-center text-accent-red text-sm font-bold">
                      &#10005;
                    </div>
                    <p className="text-sm text-foreground/90">{item.action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : weekly_summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card glow className="border-gold/30">
            <CardHeader>
              <CardTitle className="text-gold flex items-center gap-2">
                What to Double Down On This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weekly_summary.do_more_json?.map((item: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-charcoal-light rounded-lg border border-gold/10"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-accent-red/30">
            <CardHeader>
              <CardTitle className="text-accent-red flex items-center gap-2">
                Stop Doing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {weekly_summary.stop_doing_json?.map((item: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-charcoal-light rounded-lg border border-accent-red/10"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-red/20 flex items-center justify-center text-accent-red text-sm font-bold">
                    &#10005;
                  </div>
                  <p className="text-sm text-foreground/90">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Top Labels */}
      {(cached_dashboard?.topRepeatLabels?.length > 0 || cached_dashboard?.topStopLabels?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cached_dashboard.topRepeatLabels?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-accent-green">Winning Content DNA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cached_dashboard.topRepeatLabels.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-charcoal-lighter rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-green rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground/50 w-10 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {cached_dashboard.topStopLabels?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-accent-red">Underperforming Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cached_dashboard.topStopLabels.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-charcoal-lighter rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-red rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground/50 w-10 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Videos */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Videos</CardTitle>
        </CardHeader>
        <CardContent>
          {recent_videos.length === 0 ? (
            <div className="text-center py-8 text-foreground/60">
              No videos yet. Click &quot;Ingest Latest Videos&quot; to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {recent_videos.slice(0, 10).map((video: any) => (
                <div
                  key={video.id}
                  className="flex items-center gap-4 p-4 bg-charcoal-light rounded-lg border border-charcoal-lighter hover:border-gold/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-16 h-20 bg-charcoal-lighter rounded overflow-hidden">
                    {video.thumb_url ? (
                      <img
                        src={video.thumb_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        &#127916;
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate mb-1">{video.caption}</p>
                    <div className="flex items-center gap-3 text-xs text-foreground/50">
                      <span>{(video.views / 1000).toFixed(0)}K views</span>
                      <span>{(video.likes / 1000).toFixed(1)}K likes</span>
                      <span>{video.comments} comments</span>
                      <span>{video.duration_s}s</span>
                    </div>
                    {video.processing_status === "FAILED" && video.processing_error && (
                      <p className="text-xs text-accent-red mt-1 truncate">
                        Error: {video.processing_error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {video.insight ? (
                      <Badge
                        variant={
                          video.insight.verdict === "REPEAT"
                            ? "repeat"
                            : video.insight.verdict === "MODIFY"
                            ? "modify"
                            : "stop"
                        }
                      >
                        {video.insight.verdict}
                      </Badge>
                    ) : video.processing_status === "FAILED" ? (
                      <>
                        <Badge variant="stop">Failed</Badge>
                        <button
                          onClick={() => handleRetry(video.id)}
                          disabled={retryingVideos.has(video.id)}
                          className="text-xs px-3 py-1 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                        >
                          {retryingVideos.has(video.id) ? "Retrying..." : "Retry"}
                        </button>
                      </>
                    ) : (
                      <Badge variant="default">{video.processing_status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dev Tools */}
      <DevTools creatorId={creatorId} />
    </div>
  );
}
