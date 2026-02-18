"use client";

import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { ConfidenceSnapshot as ConfidenceSnapshotType } from "@/lib/types";

interface Props {
  snapshot: ConfidenceSnapshotType;
  verdictCounts: { REPEAT: number; MODIFY: number; STOP: number };
}

const HOOK_TYPE_LABELS: Record<string, string> = {
  QUESTION: "Question Hook",
  BOLD_CLAIM: "Bold Claim",
  STORY: "Story Opening",
  PROBLEM_SOLUTION: "Problem / Solution",
  OTHER: "Other",
};

const LENGTH_BUCKET_LABELS: Record<string, string> = {
  "<15": "Under 15s",
  "15-25": "15\u201325s",
  "25-40": "25\u201340s",
  "40+": "Over 40s",
};

export default function ConfidenceSnapshot({ snapshot, verdictCounts }: Props) {
  const total = verdictCounts.REPEAT + verdictCounts.MODIFY + verdictCounts.STOP;
  const pctRepeat = total > 0 ? Math.round((verdictCounts.REPEAT / total) * 100) : 0;
  const pctModify = total > 0 ? Math.round((verdictCounts.MODIFY / total) * 100) : 0;
  const pctStop = total > 0 ? Math.round((verdictCounts.STOP / total) * 100) : 0;

  return (
    <Card glow className="border-gold/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-gold">Confidence Snapshot</CardTitle>
          <Badge variant="repeat">
            {snapshot.analyzedCount} video{snapshot.analyzedCount !== 1 ? "s" : ""} analyzed
          </Badge>
        </div>
        <p className="text-sm text-foreground/60 mt-1">
          Early content intelligence based on your analyzed videos.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Best Hook Type */}
          <div className="p-4 bg-charcoal-light rounded-lg border border-charcoal-lighter">
            <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
              Best Hook Type
            </p>
            {snapshot.bestHookType ? (
              <>
                <p className="text-lg font-bold text-gold">
                  {HOOK_TYPE_LABELS[snapshot.bestHookType.hookType] ||
                    snapshot.bestHookType.hookType}
                </p>
                <p className="text-xs text-foreground/60 mt-1">
                  {snapshot.bestHookType.avgLikeRate}% avg like rate
                  &middot; {snapshot.bestHookType.videoCount} video
                  {snapshot.bestHookType.videoCount !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-foreground/40">Not enough data</p>
            )}
          </div>

          {/* Best Length */}
          <div className="p-4 bg-charcoal-light rounded-lg border border-charcoal-lighter">
            <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
              Best Length
            </p>
            {snapshot.bestLengthBucket ? (
              <>
                <p className="text-lg font-bold text-gold">
                  {LENGTH_BUCKET_LABELS[snapshot.bestLengthBucket.lengthBucket] ||
                    snapshot.bestLengthBucket.lengthBucket}
                </p>
                <p className="text-xs text-foreground/60 mt-1">
                  {snapshot.bestLengthBucket.avgLikeRate}% avg like rate
                  &middot; {snapshot.bestLengthBucket.videoCount} video
                  {snapshot.bestLengthBucket.videoCount !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-foreground/40">Not enough data</p>
            )}
          </div>

          {/* Verdict Distribution */}
          <div className="p-4 bg-charcoal-light rounded-lg border border-charcoal-lighter">
            <p className="text-xs text-foreground/50 uppercase tracking-wide mb-2">
              Verdict Split
            </p>
            {total > 0 ? (
              <>
                <div className="flex h-3 rounded-full overflow-hidden mb-2">
                  {pctRepeat > 0 && (
                    <div
                      className="bg-accent-green"
                      style={{ width: `${pctRepeat}%` }}
                    />
                  )}
                  {pctModify > 0 && (
                    <div
                      className="bg-accent-amber"
                      style={{ width: `${pctModify}%` }}
                    />
                  )}
                  {pctStop > 0 && (
                    <div
                      className="bg-accent-red"
                      style={{ width: `${pctStop}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-foreground/60">
                  <span className="text-accent-green">{pctRepeat}%</span>
                  <span className="text-accent-amber">{pctModify}%</span>
                  <span className="text-accent-red">{pctStop}%</span>
                </div>
                <div className="flex justify-between text-xs text-foreground/40 mt-0.5">
                  <span>Repeat</span>
                  <span>Modify</span>
                  <span>Stop</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground/40">No verdicts yet</p>
            )}
          </div>

          {/* Post This Next */}
          <div className="p-4 bg-charcoal-light rounded-lg border border-gold/20">
            <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
              Post This Next
            </p>
            {snapshot.postThisNext ? (
              <>
                <p className="text-sm font-semibold text-gold">
                  {HOOK_TYPE_LABELS[snapshot.postThisNext.hookType] ||
                    snapshot.postThisNext.hookType}
                  {" + "}
                  {LENGTH_BUCKET_LABELS[snapshot.postThisNext.lengthBucket] ||
                    snapshot.postThisNext.lengthBucket}
                </p>
                <p className="text-xs text-foreground/60 mt-1">
                  {snapshot.postThisNext.avgLikeRate}% avg like rate
                </p>
                {snapshot.postThisNext.sampleCaption && (
                  <p className="text-xs text-foreground/40 mt-2 truncate italic">
                    Like: &quot;{snapshot.postThisNext.sampleCaption}&quot;
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground/40">Not enough data</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
