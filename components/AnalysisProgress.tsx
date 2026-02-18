"use client";

import Card, { CardContent } from "@/components/ui/Card";

interface Props {
  analyzedCount: number;
  totalIngested: number;
}

const TARGET = 5;

export default function AnalysisProgress({ analyzedCount, totalIngested }: Props) {
  const pct = Math.min(Math.round((analyzedCount / TARGET) * 100), 100);
  const remaining = Math.max(TARGET - analyzedCount, 0);
  const reachedTarget = analyzedCount >= TARGET;

  return (
    <Card className="border-gold/20 bg-gold/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-charcoal-lighter"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  className="text-gold transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-gold">
                  {analyzedCount}/{TARGET}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {reachedTarget ? "Analysis complete" : "Analyzing your content..."}
            </p>
            <p className="text-sm text-foreground/60 mt-1">
              {analyzedCount} of {TARGET} videos analyzed ({pct}% complete).
              {!reachedTarget && remaining > 0 && (
                <> {remaining} more to go.</>
              )}
            </p>
            <div className="mt-3 h-2 bg-charcoal-lighter rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {reachedTarget ? (
              <p className="text-xs text-gold mt-2">
                Click &quot;Recompute Dashboard&quot; to generate your Confidence Snapshot.
              </p>
            ) : (
              <p className="text-xs text-foreground/40 mt-2">
                Your Confidence Snapshot will unlock once {TARGET} videos are fully analyzed.
                {totalIngested < TARGET && (
                  <> You have {totalIngested} video{totalIngested !== 1 ? "s" : ""} ingested &mdash; ingest more to reach the target.</>
                )}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
