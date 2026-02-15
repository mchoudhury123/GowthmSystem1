"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Video } from "@/lib/types";
import { getActiveCreatorId } from "@/lib/creatorContext";
import { fetchVideoAssets, retryFailedVideo } from "@/lib/api";

export default function VideosPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [filter, setFilter] = useState<"all" | "repeat" | "modify" | "stop" | "pending" | "failed">("all");
  const [frameUrls, setFrameUrls] = useState<string[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [retryingVideos, setRetryingVideos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = getActiveCreatorId();
    if (!id) {
      router.push("/connect");
      return;
    }
    setCreatorId(id);
  }, [router]);

  const fetchVideos = async () => {
    if (!creatorId) return;
    try {
      const response = await fetch(`/api/creators/${creatorId}/dashboard`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setVideos(data.recent_videos || []);
    } catch (err) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (creatorId) fetchVideos();
  }, [creatorId]);

  // Load frames when a video is selected
  useEffect(() => {
    if (!selectedVideo) {
      setFrameUrls([]);
      return;
    }

    setLoadingFrames(true);
    fetchVideoAssets(selectedVideo.id)
      .then((data) => {
        setFrameUrls(data.frames || []);
      })
      .catch(() => {
        setFrameUrls([]);
      })
      .finally(() => {
        setLoadingFrames(false);
      });
  }, [selectedVideo?.id]);

  const handleRetry = async (videoId: string) => {
    setRetryingVideos((prev) => new Set(prev).add(videoId));
    try {
      await retryFailedVideo(videoId);
      await fetchVideos();
      setSelectedVideo(null);
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

  const filteredVideos = videos.filter((video) => {
    if (filter === "all") return true;
    if (filter === "pending") return !video.insight && video.processing_status !== "FAILED";
    if (filter === "failed") return video.processing_status === "FAILED";
    return video.insight?.verdict === filter.toUpperCase();
  });

  if (loading || !creatorId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground/60">Loading videos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Videos</h1>
          <p className="text-foreground/60">All analyzed content with verdicts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {["all", "repeat", "modify", "stop", "pending", "failed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                filter === f
                  ? "bg-gold text-charcoal"
                  : "bg-charcoal-light text-foreground/70 hover:bg-charcoal-lighter"
              }
            `}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-12 text-foreground/50">
          No videos found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              className="cursor-pointer hover:border-gold/50 transition-colors"
              onClick={() => setSelectedVideo(video)}
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-[3/4] bg-charcoal-lighter rounded-t-lg overflow-hidden">
                  {video.thumb_url ? (
                    <img
                      src={video.thumb_url}
                      alt={video.caption}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      &#127916;
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
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
                      <Badge variant="stop">Failed</Badge>
                    ) : (
                      <Badge variant="default">Pending</Badge>
                    )}
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/80 px-2 py-1 rounded text-xs text-white">
                    {video.duration_s}s
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <p className="text-sm text-foreground/90 line-clamp-2 min-h-[2.5rem]">
                    {video.caption}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-foreground/50">
                    <span>{(video.views / 1000).toFixed(0)}K views</span>
                    <span>{(video.likes / 1000).toFixed(1)}K likes</span>
                    <span>{video.comments} comments</span>
                  </div>
                  {video.processing_status === "FAILED" && video.processing_error && (
                    <p className="text-xs text-accent-red truncate">
                      {video.processing_error}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Detail Modal */}
      <Modal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        title="Video Details"
      >
        {selectedVideo && (
          <div className="space-y-6">
            {/* Video Info */}
            <div>
              <p className="text-foreground font-medium mb-2">{selectedVideo.caption}</p>
              <div className="flex items-center gap-4 text-sm text-foreground/60">
                <span>{selectedVideo.views.toLocaleString()} views</span>
                <span>{selectedVideo.likes.toLocaleString()} likes</span>
                <span>{selectedVideo.comments} comments</span>
                <span>{selectedVideo.duration_s}s</span>
              </div>
            </div>

            {/* Failed State */}
            {selectedVideo.processing_status === "FAILED" && (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-accent-red mb-1">Processing Failed</p>
                {selectedVideo.processing_error && (
                  <p className="text-xs text-foreground/60 mb-3">{selectedVideo.processing_error}</p>
                )}
                <button
                  onClick={() => handleRetry(selectedVideo.id)}
                  disabled={retryingVideos.has(selectedVideo.id)}
                  className="text-sm px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                  {retryingVideos.has(selectedVideo.id) ? "Retrying..." : "Retry Processing"}
                </button>
              </div>
            )}

            {selectedVideo.insight ? (
              <>
                {/* Verdict */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground/60 mb-2">Verdict</h3>
                  <Badge
                    variant={
                      selectedVideo.insight.verdict === "REPEAT"
                        ? "repeat"
                        : selectedVideo.insight.verdict === "MODIFY"
                        ? "modify"
                        : "stop"
                    }
                    className="text-base px-4 py-1"
                  >
                    {selectedVideo.insight.verdict}
                  </Badge>
                </div>

                {/* Why */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground/60 mb-3">Why</h3>
                  <ul className="space-y-2">
                    {selectedVideo.insight.why.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-gold mt-0.5">&#8226;</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Action */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground/60 mb-2">Next Action</h3>
                  <p className="text-sm text-gold font-medium bg-gold/10 border border-gold/20 rounded-lg p-3">
                    {selectedVideo.insight.next_action}
                  </p>
                </div>

                {/* Labels */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground/60 mb-3">Content DNA</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-charcoal-light rounded-lg p-3">
                      <p className="text-xs text-foreground/50 mb-1">Hook Type</p>
                      <p className="text-sm text-foreground font-medium">
                        {selectedVideo.insight.labels.hook_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="bg-charcoal-light rounded-lg p-3">
                      <p className="text-xs text-foreground/50 mb-1">Format</p>
                      <p className="text-sm text-foreground font-medium">
                        {selectedVideo.insight.labels.format.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="bg-charcoal-light rounded-lg p-3">
                      <p className="text-xs text-foreground/50 mb-1">CTA Timing</p>
                      <p className="text-sm text-foreground font-medium">
                        {selectedVideo.insight.labels.cta_timing}
                      </p>
                    </div>
                    <div className="bg-charcoal-light rounded-lg p-3">
                      <p className="text-xs text-foreground/50 mb-1">Length</p>
                      <p className="text-sm text-foreground font-medium">
                        {selectedVideo.insight.labels.length_bucket}s
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Analysis */}
                {selectedVideo.insight.cta_analysis && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/60 mb-3">CTA Analysis</h3>
                    <div className="bg-charcoal-light rounded-lg p-4 space-y-3 border border-charcoal-lighter">
                      {selectedVideo.insight.cta_analysis.cta_detected ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-foreground/50 mb-1">CTA Detected</p>
                              <p className="text-sm text-foreground font-medium italic">
                                &ldquo;{selectedVideo.insight.cta_analysis.cta_phrase}&rdquo;
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-foreground/50 mb-1">Position</p>
                              <p className="text-sm text-foreground font-medium">
                                {selectedVideo.insight.cta_analysis.cta_position_percent}% into video
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-charcoal-lighter rounded-full h-2 relative">
                            <div
                              className={`h-2 rounded-full ${
                                selectedVideo.insight.cta_analysis.cta_timing === "EARLY"
                                  ? "bg-accent-green"
                                  : selectedVideo.insight.cta_analysis.cta_timing === "MID"
                                  ? "bg-gold"
                                  : "bg-accent-red"
                              }`}
                              style={{ width: `${selectedVideo.insight.cta_analysis.cta_position_percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-foreground/40">
                            <span>EARLY (0-25%)</span>
                            <span>MID (25-75%)</span>
                            <span>LATE (75-100%)</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-accent-red text-sm">&#9888;</span>
                          <p className="text-sm text-foreground/70">No CTA detected</p>
                        </div>
                      )}
                      <p className="text-sm text-foreground/70 leading-relaxed border-t border-charcoal-lighter pt-3">
                        {selectedVideo.insight.cta_analysis.cta_reasoning}
                      </p>
                    </div>
                  </div>
                )}

                {/* Visual Notes */}
                {selectedVideo.insight.visual_notes && selectedVideo.insight.visual_notes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/60 mb-3">Visual Notes</h3>
                    <ul className="space-y-2">
                      {selectedVideo.insight.visual_notes.map((note: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                          <span className="text-purple-400 mt-0.5">&#9679;</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : selectedVideo.processing_status !== "FAILED" ? (
              <div className="text-center py-8">
                <p className="text-foreground/50">Analysis pending for this video</p>
              </div>
            ) : null}

            {/* Key Frames */}
            <div>
              <h3 className="text-sm font-semibold text-foreground/60 mb-3">Key Frames</h3>
              {loadingFrames ? (
                <p className="text-sm text-foreground/50">Loading frames...</p>
              ) : frameUrls.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {frameUrls.map((url, idx) => (
                    <div key={idx} className="aspect-video bg-charcoal-lighter rounded overflow-hidden">
                      <img
                        src={url}
                        alt={`Frame ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/40">No frames extracted yet.</p>
              )}
            </div>

            {/* Transcript */}
            {selectedVideo.transcript && (
              <details className="group">
                <summary className="text-sm font-semibold text-foreground/60 cursor-pointer hover:text-foreground/80 transition-colors">
                  Transcript
                </summary>
                <div className="mt-3 p-4 bg-charcoal-light rounded-lg border border-charcoal-lighter max-h-64 overflow-y-auto">
                  <p className="text-sm text-foreground/70 whitespace-pre-wrap leading-relaxed">
                    {selectedVideo.transcript}
                  </p>
                </div>
              </details>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
