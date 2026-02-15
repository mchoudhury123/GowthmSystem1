"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { setActiveCreatorId } from "@/lib/creatorContext";

export default function ConnectPage() {
  const [handle, setHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;

      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleanHandle, niche: niche || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create creator");
      }

      const creator = await response.json();
      setActiveCreatorId(creator.id);
      router.push("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-gold text-2xl">
            Connect Your TikTok
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/50 text-center mb-6">
            Enter your TikTok handle to start analyzing your content
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-foreground/60 mb-1">
                TikTok Handle
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourusername"
                className="w-full px-3 py-2 bg-charcoal-light border border-charcoal-lighter rounded-lg text-foreground focus:outline-none focus:border-gold/50"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground/60 mb-1">
                Niche (optional)
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. productivity, fitness, comedy"
                className="w-full px-3 py-2 bg-charcoal-light border border-charcoal-lighter rounded-lg text-foreground focus:outline-none focus:border-gold/50"
              />
            </div>
            {error && (
              <p className="text-sm text-accent-red">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !handle.trim()}
              className="w-full px-4 py-2.5 bg-gold hover:bg-gold-dark text-charcoal font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect & Start Analyzing"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
