import { supabaseServer } from "./supabaseServer";
import { NEXT_POST_DEBOUNCE_HOURS } from "./config";

// ── Hook Templates ──
// Keyed by HookType. Each has 3 variants with {topic} and {length} placeholders.
const HOOK_TEMPLATES: Record<string, [string, string, string]> = {
  QUESTION: [
    "How to {topic} in under {length}",
    "Why do most people fail at {topic}?",
    "What if {topic} was easier than you think?",
  ],
  BOLD_CLAIM: [
    "Most people fail at {topic} because they ignore this",
    "If you want {topic}, stop doing this",
    "{topic} isn't what you think — here's the truth",
  ],
  STORY: [
    "I tried {topic} for 30 days and here's what happened",
    "The moment I realized {topic} changed everything",
    "Nobody told me this about {topic} until it was too late",
  ],
  PROBLEM_SOLUTION: [
    "Struggling with {topic}? Here's the fix",
    "The #1 reason {topic} fails — and how to fix it",
    "Stop overthinking {topic}. Do this instead",
  ],
  OTHER: [
    "Here's what nobody tells you about {topic}",
    "The simple truth about {topic}",
    "{topic} — explained in {length}",
  ],
};

// ── Structure Outline Templates ──
// Maps length_bucket to time slots for hook/problem/solution sections.
const STRUCTURE_TEMPLATES: Record<string, { hook: string; problem: string; solution: string }> = {
  "<15": { hook: "0–3s", problem: "3–8s", solution: "8–12s" },
  "15-25": { hook: "0–5s", problem: "5–12s", solution: "12–22s" },
  "25-40": { hook: "0–5s", problem: "5–15s", solution: "15–35s" },
  "40+": { hook: "0–5s", problem: "5–20s", solution: "20–50s" },
};

// Maps cta_window to a human-readable placement string.
const CTA_PLACEMENT: Record<string, string> = {
  EARLY: "Within hook (first 5s)",
  MID: "At problem/solution transition",
  LATE: "Final 5–10s of video",
  NONE: "No CTA needed",
};

// ── Length Labels (for template placeholders) ──
const LENGTH_LABELS: Record<string, string> = {
  "<15": "15 seconds",
  "15-25": "25 seconds",
  "25-40": "40 seconds",
  "40+": "60 seconds",
};

// ── Stop Words for caption keyword extraction ──
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
  "be", "has", "have", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "not", "no", "so", "if",
  "up", "out", "just", "about", "into", "over", "after", "before",
  "your", "you", "my", "me", "i", "we", "they", "he", "she", "its",
  "what", "how", "when", "where", "why", "who", "which", "all", "each",
  "every", "both", "few", "more", "most", "some", "any", "other",
  "new", "old", "big", "small", "long", "short", "good", "bad",
  "first", "last", "next", "same", "different", "much", "many",
  "here", "there", "now", "then", "also", "very", "really", "too",
  "still", "already", "even", "back", "well", "way", "like", "get",
  "got", "go", "going", "been", "being", "make", "made", "take",
  "know", "think", "see", "come", "want", "use", "find", "give",
  "tell", "say", "said", "one", "two", "three", "don't", "didn't",
  "won't", "can't", "it's", "i'm", "you're", "that's", "there's",
  "im", "dont", "cant", "wont", "didnt", "youre", "thats", "ive",
]);

/**
 * Compute and store the "Post This Next" recommendation for a creator.
 * Derives hook variants, structure outline, and suggested topic from
 * the creator's dominant playbook cluster — no LLM, pure rule-based.
 *
 * Debounced: skips if computed within NEXT_POST_DEBOUNCE_HOURS.
 */
export async function computeNextPostRecommendation(
  creatorId: string
): Promise<void> {
  // 1. Debounce check
  const { data: existing } = await supabaseServer
    .from("creator_next_post")
    .select("generated_at")
    .eq("creator_id", creatorId)
    .single();

  if (existing?.generated_at) {
    const hoursSince =
      (Date.now() - new Date(existing.generated_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < NEXT_POST_DEBOUNCE_HOURS) {
      console.log(
        `[NextPost] Skipping ${creatorId} — generated ${hoursSince.toFixed(1)}h ago (debounce: ${NEXT_POST_DEBOUNCE_HOURS}h)`
      );
      return;
    }
  }

  // 2. Fetch creator playbook (dominant cluster)
  const { data: playbook } = await supabaseServer
    .from("creator_playbook")
    .select("*")
    .eq("creator_id", creatorId)
    .single();

  if (!playbook) {
    console.log(`[NextPost] No playbook for ${creatorId}, skipping`);
    return;
  }

  // 3. Fetch videos matching the dominant cluster
  const { data: videos } = await supabaseServer
    .from("videos")
    .select("id, caption, views, likes, created_at_ts")
    .eq("creator_id", creatorId)
    .eq("processing_status", "DONE");

  if (!videos || videos.length === 0) {
    console.log(`[NextPost] No DONE videos for ${creatorId}, skipping`);
    return;
  }

  const videoIds = videos.map((v: any) => v.id);
  const { data: insights } = await supabaseServer
    .from("video_insights")
    .select("video_id, verdict, labels_json, recommendations_json")
    .in("video_id", videoIds);

  if (!insights || insights.length === 0) {
    console.log(`[NextPost] No insights for ${creatorId}, skipping`);
    return;
  }

  // Build insight lookup
  const insightMap: Record<string, any> = {};
  for (const ins of insights) {
    insightMap[ins.video_id] = ins;
  }

  // 4. Filter to videos matching dominant cluster exactly
  const clusterVideos: Array<{ id: string; caption: string; likeRate: number; verdict: string; recommendations: any; createdAt: string }> = [];

  for (const v of videos) {
    const ins = insightMap[v.id];
    if (!ins || v.views <= 0) continue;

    const labels = ins.labels_json;
    if (
      labels?.hook_type === playbook.dominant_hook_type &&
      labels?.format === playbook.dominant_format &&
      labels?.length_bucket === playbook.dominant_length_bucket &&
      labels?.cta_timing === playbook.dominant_cta_window
    ) {
      clusterVideos.push({
        id: v.id,
        caption: v.caption || "",
        likeRate: (v.likes / v.views) * 100,
        verdict: ins.verdict,
        recommendations: ins.recommendations_json,
        createdAt: v.created_at_ts || v.id,
      });
    }
  }

  if (clusterVideos.length === 0) {
    console.log(`[NextPost] No cluster-matching videos for ${creatorId}, skipping`);
    return;
  }

  // 5. Sort by like_rate DESC, take top 5
  clusterVideos.sort((a, b) => b.likeRate - a.likeRate);
  const topVideos = clusterVideos.slice(0, 5);

  // 6. Derive suggested topic
  const suggestedTopic = deriveTopic(topVideos);

  // 7. Generate hook variants
  const hookType = playbook.dominant_hook_type;
  const lengthBucket = playbook.dominant_length_bucket;
  const lengthLabel = LENGTH_LABELS[lengthBucket] || "30 seconds";

  const templates = HOOK_TEMPLATES[hookType] || HOOK_TEMPLATES.OTHER;
  const hookVariant1 = fillTemplate(templates[0], suggestedTopic, lengthLabel);
  const hookVariant2 = fillTemplate(templates[1], suggestedTopic, lengthLabel);
  const hookVariant3 = fillTemplate(templates[2], suggestedTopic, lengthLabel);

  // 8. Generate structure outline
  const structureBase = STRUCTURE_TEMPLATES[lengthBucket] || STRUCTURE_TEMPLATES["25-40"];
  const ctaWindow = playbook.dominant_cta_window;
  const structureOutline = {
    hook: structureBase.hook,
    problem: structureBase.problem,
    solution: structureBase.solution,
    cta: CTA_PLACEMENT[ctaWindow] || CTA_PLACEMENT.LATE,
  };

  // 9. Upsert
  const { error } = await supabaseServer
    .from("creator_next_post")
    .upsert(
      {
        creator_id: creatorId,
        hook_type: hookType,
        format: playbook.dominant_format,
        length_bucket: lengthBucket,
        cta_window: ctaWindow,
        suggested_topic: suggestedTopic,
        hook_variant_1: hookVariant1,
        hook_variant_2: hookVariant2,
        hook_variant_3: hookVariant3,
        structure_outline: structureOutline,
        based_on_cluster_video_count: clusterVideos.length,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "creator_id" }
    );

  if (error) {
    throw new Error(`Failed to upsert creator_next_post: ${error.message}`);
  }

  console.log(
    `[NextPost] Computed for ${creatorId}: "${suggestedTopic}" (${hookType}, ${clusterVideos.length} cluster videos)`
  );
}

/**
 * Derive a suggested topic from top cluster videos.
 * Strategy:
 *   1. Check for suggested_next_topic from REPEAT-verdict recommendations
 *   2. Fall back to caption keyword extraction
 *   3. Final fallback: "your niche topic"
 */
function deriveTopic(
  topVideos: Array<{ caption: string; verdict: string; recommendations: any; createdAt: string }>
): string {
  // Strategy 1: Use suggested_next_topic from REPEAT-verdict videos (most recent first)
  const repeatVideos = topVideos
    .filter((v) => v.verdict === "REPEAT" && v.recommendations?.suggested_next_topic)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  if (repeatVideos.length > 0) {
    return repeatVideos[0].recommendations.suggested_next_topic;
  }

  // Strategy 2: Extract most common meaningful words from captions
  const allCaptions = topVideos.map((v) => v.caption).join(" ");
  const extracted = extractTopPhrase(allCaptions);
  if (extracted) {
    return extracted;
  }

  // Strategy 3: Fallback
  return "your niche topic";
}

/**
 * Extract the most frequent meaningful bigram from a block of text.
 * Returns the top phrase, or null if nothing meaningful found.
 */
function extractTopPhrase(text: string): string | null {
  // Clean and tokenize
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length === 0) return null;

  // Count bigrams
  const bigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigrams[bigram] = (bigrams[bigram] || 0) + 1;
  }

  // Find the most frequent bigram
  let bestPhrase: string | null = null;
  let bestCount = 0;
  for (const [phrase, count] of Object.entries(bigrams)) {
    if (count > bestCount) {
      bestCount = count;
      bestPhrase = phrase;
    }
  }

  // Only use if it appeared more than once, otherwise fall back to most common single word
  if (bestPhrase && bestCount > 1) {
    return bestPhrase;
  }

  // Fall back to most frequent single word
  const wordCounts: Record<string, number> = {};
  for (const w of words) {
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  }

  let bestWord: string | null = null;
  let bestWordCount = 0;
  for (const [word, count] of Object.entries(wordCounts)) {
    if (count > bestWordCount) {
      bestWordCount = count;
      bestWord = word;
    }
  }

  return bestWord;
}

/**
 * Fill a hook template with topic and length values.
 */
function fillTemplate(template: string, topic: string, length: string): string {
  return template.replace(/\{topic\}/g, topic).replace(/\{length\}/g, length);
}
