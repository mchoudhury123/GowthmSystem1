import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { mockRecommendation } from "@/lib/mock/data";

export default function RecommendationsPage() {
  const { title, recommendation, reasoning, template } = mockRecommendation;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Recommendations</h1>
        <p className="text-foreground/60">AI-powered suggestions for your next content</p>
      </div>

      {/* Main Recommendation Card */}
      <Card glow className="border-gold/30">
        <CardHeader>
          <CardTitle className="text-2xl text-gold flex items-center gap-3">
            <span className="text-4xl">💡</span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Recommendation */}
          <div className="bg-gradient-to-br from-gold/10 to-champagne/5 border border-gold/20 rounded-lg p-6">
            <p className="text-xl font-semibold text-foreground mb-2">
              {recommendation}
            </p>
          </div>

          {/* Reasoning */}
          <div>
            <h3 className="text-sm font-semibold text-foreground/60 mb-3">Why This Works</h3>
            <ul className="space-y-2">
              {reasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-foreground/80 pt-0.5">{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Template */}
          <div>
            <h3 className="text-sm font-semibold text-foreground/60 mb-3">Content Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-charcoal-light rounded-lg p-4 border border-charcoal-lighter">
                <p className="text-xs text-foreground/50 mb-2">Hook</p>
                <p className="text-sm text-champagne font-medium">{template.hook}</p>
              </div>
              <div className="bg-charcoal-light rounded-lg p-4 border border-charcoal-lighter">
                <p className="text-xs text-foreground/50 mb-2">Format</p>
                <p className="text-sm text-foreground">{template.format}</p>
              </div>
              <div className="bg-charcoal-light rounded-lg p-4 border border-charcoal-lighter">
                <p className="text-xs text-foreground/50 mb-2">Optimal Length</p>
                <p className="text-sm text-foreground">{template.length}</p>
              </div>
              <div className="bg-charcoal-light rounded-lg p-4 border border-charcoal-lighter">
                <p className="text-xs text-foreground/50 mb-2">CTA Timing</p>
                <p className="text-sm text-foreground">{template.cta}</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button className="w-full bg-gold hover:bg-gold-dark text-charcoal font-semibold py-3 px-6 rounded-lg transition-colors">
              Start Creating This Video
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Additional Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>⚡</span>
              Quick Win
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70">
              Batch record 5 question-hook videos in one session. Your audience responds best to
              this format, and batching saves production time.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>🎯</span>
              Focus Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70">
              Keep experimenting with bold claims in your hooks. They're your second-best
              performer and have room to grow.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>🚫</span>
              Avoid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70">
              Skip text-on-screen content for now. Your audience prefers authentic, face-to-camera
              delivery over polished graphics.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
