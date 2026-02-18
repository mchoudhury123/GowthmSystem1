"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getActiveCreatorId } from "@/lib/creatorContext";
import { fetchQueueData, recoverStuckJobs, retryFailedVideo } from "@/lib/api";

interface JobVideo {
  tiktok_id: string;
  caption: string;
  thumb_url: string;
  processing_status: string;
}

interface Job {
  id: string;
  creator_id: string;
  video_id: string | null;
  job_type: string;
  status: string;
  stage: string | null;
  attempts: number;
  error_message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  video: JobVideo | null;
}

interface QueueStats {
  queued: number;
  running: number;
  done: number;
  failed: number;
}

interface RedisStats {
  ingest_creator: { queued: number; processing: number };
  process_video: { queued: number; processing: number };
}

interface Usage {
  videos_ingested: number;
  videos_analyzed: number;
  llm_calls: number;
  frames_extracted: number;
  whisper_calls: number;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case "QUEUED":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "RUNNING":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "DONE":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "FAILED":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-foreground/10 text-foreground/60 border-foreground/20";
  }
}

function stageLabel(stage: string | null, status: string): string {
  if (status === "DONE") return "Complete";
  if (status === "FAILED") return "Failed";
  if (status === "QUEUED") return "In queue";
  if (!stage) return "Processing";
  return stage.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function QueuePage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<QueueStats>({ queued: 0, running: 0, done: 0, failed: 0 });
  const [redisStats, setRedisStats] = useState<RedisStats | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const loadData = useCallback(async (id: string) => {
    try {
      const data = await fetchQueueData(id);
      setJobs(data.jobs || []);
      setStats(data.stats || { queued: 0, running: 0, done: 0, failed: 0 });
      setRedisStats(data.redis_stats || null);
      setUsage(data.usage || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = getActiveCreatorId();
    if (!id) {
      router.push("/connect");
      return;
    }
    setCreatorId(id);
    loadData(id);
  }, [router, loadData]);

  // Auto-refresh while there are active jobs
  useEffect(() => {
    if (!creatorId) return;
    const hasActive = stats.queued > 0 || stats.running > 0;
    if (!hasActive) return;

    const interval = setInterval(() => loadData(creatorId), 5000);
    return () => clearInterval(interval);
  }, [creatorId, stats.queued, stats.running, loadData]);

  const handleRecover = async () => {
    setRecovering(true);
    try {
      const result = await recoverStuckJobs();
      const total = result.recovered.ingest_creator + result.recovered.process_video;
      if (total > 0 && creatorId) {
        await loadData(creatorId);
      }
    } catch (err) {
      console.error("Recovery failed:", err);
    } finally {
      setRecovering(false);
    }
  };

  const handleRetry = async (videoId: string) => {
    setRetrying(videoId);
    try {
      await retryFailedVideo(videoId);
      if (creatorId) {
        await loadData(creatorId);
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setRetrying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/50">Loading queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const totalRedisActive =
    (redisStats?.ingest_creator.queued || 0) +
    (redisStats?.ingest_creator.processing || 0) +
    (redisStats?.process_video.queued || 0) +
    (redisStats?.process_video.processing || 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processing Queue</h1>
          <p className="text-sm text-foreground/50 mt-1">
            Job status, retries, and failure recovery
          </p>
        </div>
        <button
          onClick={handleRecover}
          disabled={recovering}
          className="px-4 py-2 text-sm bg-charcoal-lighter text-foreground/70 rounded-lg border border-charcoal-lighter hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
        >
          {recovering ? "Recovering..." : "Recover Stuck Jobs"}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.queued}</div>
            <div className="text-xs text-foreground/50 mt-1">Queued</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-400">{stats.running}</div>
            <div className="text-xs text-foreground/50 mt-1">Processing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-emerald-400">{stats.done}</div>
            <div className="text-xs text-foreground/50 mt-1">Done</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-foreground/50 mt-1">Failed</div>
          </CardContent>
        </Card>
      </div>

      {/* Redis Queue Status */}
      {totalRedisActive > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="text-sm text-blue-400 font-medium">Live Queue</div>
          <div className="flex gap-6 mt-2 text-xs text-foreground/60">
            <span>
              Ingest: {redisStats?.ingest_creator.queued || 0} queued, {redisStats?.ingest_creator.processing || 0} processing
            </span>
            <span>
              Video: {redisStats?.process_video.queued || 0} queued, {redisStats?.process_video.processing || 0} processing
            </span>
          </div>
        </div>
      )}

      {/* Monthly Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Usage ({new Date().toISOString().slice(0, 7)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-foreground">{usage.videos_ingested}</div>
                <div className="text-xs text-foreground/50">Ingested</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">{usage.videos_analyzed}</div>
                <div className="text-xs text-foreground/50">Analyzed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">{usage.llm_calls}</div>
                <div className="text-xs text-foreground/50">LLM Calls</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">{usage.frames_extracted}</div>
                <div className="text-xs text-foreground/50">Frames</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">{usage.whisper_calls}</div>
                <div className="text-xs text-foreground/50">Whisper</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Job History</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center text-foreground/40 py-8">
              No jobs yet. Trigger an ingestion from the Overview page.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-charcoal-light/50 border border-charcoal-lighter/50"
                >
                  {/* Video thumbnail or job type icon */}
                  <div className="w-10 h-10 rounded bg-charcoal-lighter flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {job.video?.thumb_url ? (
                      <img
                        src={job.video.thumb_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-foreground/40">
                        {job.job_type === "INGEST_CREATOR" ? "IN" : "PR"}
                      </span>
                    )}
                  </div>

                  {/* Job info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {job.video?.caption
                          ? job.video.caption.slice(0, 60) + (job.video.caption.length > 60 ? "..." : "")
                          : job.job_type === "INGEST_CREATOR"
                            ? "Creator Ingestion"
                            : `Process Video`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-foreground/40">
                      <span>{job.job_type === "INGEST_CREATOR" ? "Ingest" : "Process"}</span>
                      <span>{stageLabel(job.stage, job.status)}</span>
                      <span>{job.attempts > 0 ? `${job.attempts}/3 attempts` : ""}</span>
                      <span>{timeAgo(job.updated_at || job.created_at)}</span>
                    </div>
                    {/* Error message (expandable) */}
                    {job.error_message && (
                      <div className="mt-1">
                        <button
                          onClick={() =>
                            setExpandedError(expandedError === job.id ? null : job.id)
                          }
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          {expandedError === job.id
                            ? job.error_message
                            : job.error_message.slice(0, 80) +
                              (job.error_message.length > 80 ? "..." : "")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium border ${statusColor(job.status)}`}
                  >
                    {job.status}
                  </div>

                  {/* Retry button for failed video jobs */}
                  {job.status === "FAILED" && job.video_id && (
                    <button
                      onClick={() => handleRetry(job.video_id!)}
                      disabled={retrying === job.video_id}
                      className="px-3 py-1 text-xs bg-gold/10 text-gold border border-gold/20 rounded hover:bg-gold/20 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {retrying === job.video_id ? "..." : "Re-run"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
