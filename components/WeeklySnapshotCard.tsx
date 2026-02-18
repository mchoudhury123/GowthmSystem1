"use client";

import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { WeeklySummary } from "@/lib/types";

interface Props {
  summary: WeeklySummary;
}

const DRIFT_FLAG_STYLES: Record<string, { bg: string; text: string }> = {
  "Length Drift": { bg: "bg-accent-amber/20", text: "text-accent-amber" },
  "Consistency Drop": { bg: "bg-accent-red/20", text: "text-accent-red" },
  "Hook Experimentation Phase": { bg: "bg-purple-500/20", text: "text-purple-400" },
};

export default function WeeklySnapshotCard({ summary }: Props) {
  const weekStart = summary.week_start
    ? new Date(summary.week_start + "T00:00:00")
    : null;
  const weekEnd = weekStart
    ? new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
    : null;

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Card className="border-charcoal-lighter">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Since last week...</CardTitle>
          {weekStart && weekEnd && (
            <Badge variant="default">
              {formatDate(weekStart)} &mdash; {formatDate(weekEnd)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drift Flag Badges */}
        {summary.drift_flags && summary.drift_flags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {summary.drift_flags.map((flag) => {
              const style = DRIFT_FLAG_STYLES[flag] || {
                bg: "bg-accent-amber/20",
                text: "text-accent-amber",
              };
              return (
                <span
                  key={flag}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                >
                  {flag}
                </span>
              );
            })}
          </div>
        )}

        {/* 3 Insight Bullets */}
        {summary.insight_bullets && summary.insight_bullets.length > 0 && (
          <ul className="space-y-2">
            {summary.insight_bullets.map((bullet, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-sm text-foreground/80"
              >
                <span className="text-gold mt-0.5 flex-shrink-0">&#8226;</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 1 Directional Recommendation */}
        {summary.recommendation && (
          <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
            <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
              Recommendation
            </p>
            <p className="text-sm text-gold font-medium">
              {summary.recommendation}
            </p>
          </div>
        )}

        {/* Compact Snapshot Stats */}
        {summary.snapshot && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-charcoal-lighter">
            <div>
              <p className="text-xs text-foreground/50">Videos</p>
              <p className="text-lg font-bold text-foreground">
                {summary.snapshot.video_count}
              </p>
              {summary.deltas?.posting_cadence_pct != null && (
                <DeltaBadge value={summary.deltas.posting_cadence_pct} />
              )}
            </div>
            <div>
              <p className="text-xs text-foreground/50">Like Rate</p>
              <p className="text-lg font-bold text-foreground">
                {summary.snapshot.avg_like_rate}%
              </p>
              {summary.deltas?.avg_like_rate_pct != null && (
                <DeltaBadge value={summary.deltas.avg_like_rate_pct} />
              )}
            </div>
            <div>
              <p className="text-xs text-foreground/50">Avg Length</p>
              <p className="text-lg font-bold text-foreground">
                {summary.snapshot.avg_duration_s}s
              </p>
              {summary.deltas?.avg_duration_s_pct != null && (
                <DeltaBadge value={summary.deltas.avg_duration_s_pct} />
              )}
            </div>
            <div>
              <p className="text-xs text-foreground/50">CTA Success</p>
              <p className="text-lg font-bold text-foreground">
                {summary.snapshot.cta_success_rate}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={`text-xs font-medium ${
        isPositive ? "text-accent-green" : "text-accent-red"
      }`}
    >
      {isPositive ? "+" : ""}
      {value}%
    </span>
  );
}
