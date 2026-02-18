"use client";

import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { CreatorPlaybook, CreatorNextPost } from "@/lib/types";

interface Props {
  playbook: CreatorPlaybook;
  nextPost?: CreatorNextPost | null;
}

const DIMENSION_LABELS: { key: keyof CreatorPlaybook; label: string }[] = [
  { key: "dominant_hook_type", label: "Hook" },
  { key: "dominant_format", label: "Format" },
  { key: "dominant_length_bucket", label: "Length" },
  { key: "dominant_cta_window", label: "CTA Timing" },
];

const EXPERIMENT_STYLES: Record<string, { bg: string; text: string }> = {
  "Testing New Hook": { bg: "bg-accent-amber/20", text: "text-accent-amber" },
  "Testing New Format": { bg: "bg-purple-500/20", text: "text-purple-400" },
};

export default function PlaybookCard({ playbook, nextPost }: Props) {
  if (playbook.supporting_video_count < 3) {
    return (
      <Card className="border-gold/30">
        <CardHeader>
          <CardTitle className="text-gold">Your Current Winning Formula</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/50">
            We&apos;re still learning your content system. Keep posting &mdash;
            your formula will appear after we&apos;ve analyzed at least 3 videos
            with matching patterns.
          </p>
        </CardContent>
      </Card>
    );
  }

  const deltaPositive = playbook.performance_delta_percent > 0;

  return (
    <Card glow className="border-gold/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-gold">Your Current Winning Formula</CardTitle>
          {playbook.experiment_status !== "Stable" && (
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                EXPERIMENT_STYLES[playbook.experiment_status]?.bg || "bg-accent-amber/20"
              } ${
                EXPERIMENT_STYLES[playbook.experiment_status]?.text || "text-accent-amber"
              }`}
            >
              {playbook.experiment_status}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 4-cell formula grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DIMENSION_LABELS.map(({ key, label }) => (
            <div
              key={key}
              className="bg-charcoal-dark border border-charcoal-lighter rounded-lg p-3 text-center"
            >
              <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
                {label}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {String(playbook[key])}
              </p>
            </div>
          ))}
        </div>

        {/* Performance delta */}
        <div className="bg-gold/10 border border-gold/20 rounded-lg p-3">
          <p className="text-sm text-gold font-medium">
            This pattern performs{" "}
            <span className={deltaPositive ? "text-accent-green" : "text-accent-red"}>
              {deltaPositive ? "+" : ""}
              {playbook.performance_delta_percent}%
            </span>{" "}
            {deltaPositive ? "better" : "worse"} than your baseline
          </p>
        </div>

        {/* Supporting info */}
        <div className="flex items-center justify-between text-xs text-foreground/50">
          <span>
            Based on {playbook.supporting_video_count} video
            {playbook.supporting_video_count !== 1 ? "s" : ""}
          </span>
          <span>
            Baseline like rate: {playbook.median_like_rate}%
          </span>
        </div>

        {/* ── Post This Next ── */}
        <div className="border-t border-charcoal-lighter pt-4 mt-4">
          <h4 className="text-base font-semibold text-gold mb-3">
            Post This Next
          </h4>

          {nextPost ? (
            <div className="space-y-4">
              {/* Next post formula grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Format", value: nextPost.format },
                  { label: "Hook", value: nextPost.hook_type },
                  { label: "Length", value: nextPost.length_bucket },
                  { label: "CTA", value: nextPost.cta_window },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-charcoal-dark border border-gold/10 rounded-lg p-3 text-center"
                  >
                    <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
                      {label}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Suggested topic */}
              {nextPost.suggested_topic && nextPost.suggested_topic !== "your niche topic" && (
                <div className="bg-gold/5 border border-gold/15 rounded-lg p-3">
                  <p className="text-xs text-foreground/50 uppercase tracking-wide mb-1">
                    Suggested Topic
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {nextPost.suggested_topic}
                  </p>
                </div>
              )}

              {/* 3 hook drafts */}
              <div>
                <p className="text-xs text-foreground/50 uppercase tracking-wide mb-2">
                  Hook Drafts
                </p>
                <div className="space-y-2">
                  {[nextPost.hook_variant_1, nextPost.hook_variant_2, nextPost.hook_variant_3]
                    .filter(Boolean)
                    .map((hook, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-charcoal-dark rounded-lg border border-charcoal-lighter"
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-sm text-foreground/90">{hook}</p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Structure outline */}
              {nextPost.structure_outline && (
                <div>
                  <p className="text-xs text-foreground/50 uppercase tracking-wide mb-2">
                    Structure
                  </p>
                  <div className="flex items-stretch gap-1">
                    {[
                      { label: "Hook", time: nextPost.structure_outline.hook, color: "bg-gold/20 text-gold" },
                      { label: "Problem", time: nextPost.structure_outline.problem, color: "bg-accent-amber/20 text-accent-amber" },
                      { label: "Solution", time: nextPost.structure_outline.solution, color: "bg-accent-green/20 text-accent-green" },
                      { label: "CTA", time: nextPost.structure_outline.cta, color: "bg-purple-500/20 text-purple-400" },
                    ].map(({ label, time, color }) => (
                      <div
                        key={label}
                        className={`flex-1 rounded-lg p-2 text-center ${color}`}
                      >
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[10px] opacity-80 mt-0.5">{time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <p className="text-xs text-foreground/40">
                Based on your top {nextPost.based_on_cluster_video_count} performing video
                {nextPost.based_on_cluster_video_count !== 1 ? "s" : ""}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground/50">
              We need more data before suggesting your next post.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
