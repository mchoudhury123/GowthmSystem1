"use client";

import { useState, useRef } from "react";

interface IngestButtonProps {
  creatorId: string;
  onSuccess?: () => void;
}

export default function IngestButton({ creatorId, onSuccess }: IngestButtonProps) {
  const [isIngesting, setIsIngesting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dispatchRef = useRef(false);

  const handleIngest = async () => {
    setIsIngesting(true);
    setError(null);
    setStatus("Queuing ingestion...");

    try {
      // Step 1: Trigger ingestion (enqueues jobs to Redis)
      const ingestResponse = await fetch(`/api/creators/${creatorId}/ingest`, {
        method: "POST",
      });

      if (!ingestResponse.ok) {
        const data = await ingestResponse.json();
        throw new Error(data.error || "Ingestion failed");
      }

      console.log("Ingestion queued, starting dispatch loop...");
      setStatus("Scraping videos...");

      // Step 2: Auto-dispatch in a loop until queue is drained
      dispatchRef.current = true;
      let emptyRounds = 0;

      while (dispatchRef.current && emptyRounds < 3) {
        const dispatchResponse = await fetch("/api/jobs/dispatch", {
          method: "POST",
        });

        if (!dispatchResponse.ok) {
          console.warn("Dispatch call failed, retrying...");
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const result = await dispatchResponse.json();
        const { stats, processed, results } = result;

        // Update status based on what's happening
        const totalQueued = (stats?.ingest_creator?.queued || 0) + (stats?.process_video?.queued || 0);
        const totalProcessing = (stats?.ingest_creator?.processing || 0) + (stats?.process_video?.processing || 0);
        const completed = results?.filter((r: any) => r.status === "completed").length || 0;

        if (processed > 0) {
          setStatus(`Processing... ${completed}/${processed} succeeded · ${totalQueued} queued`);
        }

        // Refresh dashboard data
        if (onSuccess) onSuccess();

        // Check if we're done
        if (totalQueued === 0 && totalProcessing === 0 && processed === 0) {
          emptyRounds++;
        } else {
          emptyRounds = 0;
        }

        // Wait before next dispatch
        await new Promise((r) => setTimeout(r, 2000));
      }

      setStatus("Done!");
      if (onSuccess) onSuccess();

      // Clear status after a moment
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start ingestion");
      setStatus(null);
    } finally {
      dispatchRef.current = false;
      setIsIngesting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleIngest}
        disabled={isIngesting}
        className="px-4 py-2 bg-gold hover:bg-gold-dark text-charcoal font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isIngesting ? "Processing..." : "🔄 Ingest Latest Videos"}
      </button>
      {status && (
        <p className="mt-2 text-sm text-amber-400">{status}</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-accent-red">{error}</p>
      )}
    </div>
  );
}
