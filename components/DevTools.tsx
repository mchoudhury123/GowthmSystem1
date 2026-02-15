"use client";

import { useState } from "react";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { runVideoAnalysis, generateWeeklySummary } from "@/lib/api";

export default function DevTools({ creatorId }: { creatorId?: string }) {
  const [videoId, setVideoId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV === "development";

  if (!isDev) return null;

  const handleRunAnalysis = async () => {
    if (!videoId || !transcript) {
      setError("Video ID and transcript are required");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const data = await runVideoAnalysis(videoId, transcript);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateWeekly = async () => {
    if (!creatorId) {
      setError("Creator ID is required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const data = await generateWeeklySummary(creatorId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-amber-500 flex items-center gap-2">
          <span>🔧</span>
          Dev Tools (Development Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Run Analysis Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Run Video Analysis</h4>
          <input
            type="text"
            placeholder="Video ID (UUID)"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            className="w-full px-3 py-2 bg-charcoal-light border border-charcoal-lighter rounded-lg text-foreground text-sm focus:outline-none focus:border-gold/50"
          />
          <textarea
            placeholder="Video transcript text..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-charcoal-light border border-charcoal-lighter rounded-lg text-foreground text-sm focus:outline-none focus:border-gold/50 resize-none"
          />
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-gold hover:bg-gold-dark text-charcoal font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>

        {/* Generate Weekly Summary */}
        {creatorId && (
          <div className="space-y-3 pt-4 border-t border-charcoal-lighter">
            <h4 className="text-sm font-semibold text-foreground">
              Generate Weekly Summary
            </h4>
            <p className="text-xs text-foreground/60">
              Creator ID: {creatorId}
            </p>
            <button
              onClick={handleGenerateWeekly}
              disabled={isGenerating}
              className="px-4 py-2 bg-gold hover:bg-gold-dark text-charcoal font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate Weekly Summary"}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
            <p className="text-sm text-accent-red">{error}</p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Result</h4>
            <pre className="p-3 bg-charcoal-light border border-charcoal-lighter rounded-lg text-xs text-foreground/80 overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
