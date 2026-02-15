import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { mockPatterns } from "@/lib/mock/data";

export default function PatternsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Patterns</h1>
        <p className="text-foreground/60">Winning formulas identified from your content</p>
      </div>

      {/* Patterns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPatterns.map((pattern) => (
          <Card key={pattern.id} className="hover:border-gold/30 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">{pattern.title}</CardTitle>
                <div className="flex-shrink-0 text-3xl font-bold text-gold">
                  {pattern.success_rate}%
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/70">{pattern.description}</p>

              <div className="flex items-center justify-between pt-3 border-t border-charcoal-lighter">
                <div>
                  <p className="text-xs text-foreground/50 mb-1">Used in videos</p>
                  <p className="text-lg font-semibold text-foreground">{pattern.count}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground/50 mb-1">Success Rate</p>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-charcoal-lighter rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-champagne rounded-full"
                        style={{ width: `${pattern.success_rate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gold">
                      {pattern.success_rate}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights Section */}
      <Card glow className="border-gold/30">
        <CardHeader>
          <CardTitle className="text-gold flex items-center gap-2">
            <span>💡</span>
            Pattern Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-charcoal-light rounded-lg p-4 border border-gold/10">
              <h4 className="text-sm font-semibold text-foreground mb-2">Top Performing Hook</h4>
              <p className="text-2xl font-bold text-gold mb-1">Question Format</p>
              <p className="text-xs text-foreground/60">
                Opens with a direct question that stops the scroll
              </p>
            </div>

            <div className="bg-charcoal-light rounded-lg p-4 border border-gold/10">
              <h4 className="text-sm font-semibold text-foreground mb-2">Optimal Length</h4>
              <p className="text-2xl font-bold text-gold mb-1">15-20 seconds</p>
              <p className="text-xs text-foreground/60">
                Sweet spot for maximum retention and completion
              </p>
            </div>

            <div className="bg-charcoal-light rounded-lg p-4 border border-gold/10">
              <h4 className="text-sm font-semibold text-foreground mb-2">Best Format</h4>
              <p className="text-2xl font-bold text-gold mb-1">Talking Head</p>
              <p className="text-xs text-foreground/60">
                Authentic connection drives engagement and trust
              </p>
            </div>

            <div className="bg-charcoal-light rounded-lg p-4 border border-gold/10">
              <h4 className="text-sm font-semibold text-foreground mb-2">CTA Timing</h4>
              <p className="text-2xl font-bold text-gold mb-1">Early (0-5s)</p>
              <p className="text-xs text-foreground/60">
                Capture attention while it's at peak level
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
