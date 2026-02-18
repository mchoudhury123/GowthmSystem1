// Kimi (Moonshot) Insights Generation with Zod Validation
import { z } from "zod";
import { MAX_FRAMES_PER_VIDEO } from "@/lib/config";

const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_URL = "https://api.moonshot.ai/v1/chat/completions";

if (!KIMI_API_KEY) {
  console.warn("KIMI_API_KEY not set. Insights generation will fail.");
}

// Strict Zod schema matching the required JSON structure
const InsightLabelsSchema = z.object({
  hook_type: z.enum(["QUESTION", "BOLD_CLAIM", "STORY", "PROBLEM_SOLUTION", "OTHER"]),
  format: z.enum(["TALKING_HEAD", "BROLL", "MONTAGE", "TEXT_ON_SCREEN", "MIXED"]),
  cta_timing: z.enum(["EARLY", "MID", "LATE", "NONE"]),
  length_bucket: z.enum(["<15", "15-25", "25-40", "40+"]),
});

const CTAAnalysisSchema = z.object({
  cta_detected: z.boolean(),
  cta_phrase: z.string().nullable(),
  cta_position_percent: z.number().min(0).max(100).nullable(),
  cta_timing: z.enum(["EARLY", "MID", "LATE", "NONE"]),
  cta_reasoning: z.string().min(1),
});

const RecommendationsSchema = z.object({
  // REPEAT fields
  template_structure: z.object({
    hook_type: z.string(),
    body_format: z.string(),
    cta_timing_window: z.string(),
  }).optional(),
  hook_rewrites: z.array(z.string()).min(1).max(3).optional(),
  suggested_next_topic: z.string().optional(),
  // MODIFY fields
  change_instructions: z.array(z.object({
    instruction: z.string().min(1),
    reasoning: z.string().min(1),
  })).min(1).optional(),
  performance_delta: z.object({
    video_like_rate: z.number(),
    creator_median_like_rate: z.number().nullable(),
    delta_description: z.string(),
  }).nullable().optional(),
  // STOP fields
  pattern_explanation: z.string().optional(),
  cluster_failure_reason: z.string().optional(),
  suggested_alternative: z.object({
    format: z.string(),
    hook_type: z.string(),
    length_bucket: z.string(),
    reasoning: z.string(),
  }).optional(),
});

const InsightSchema = z.object({
  verdict: z.enum(["REPEAT", "MODIFY", "STOP"]),
  why: z.array(z.string()).min(2).max(3),
  next_action: z.string().min(1),
  labels: InsightLabelsSchema,
  cta_analysis: CTAAnalysisSchema,
  recommendations: RecommendationsSchema,
});

export type InsightLabels = z.infer<typeof InsightLabelsSchema>;
export type Insight = z.infer<typeof InsightSchema>;

const SYSTEM_PROMPT = `You are a TikTok content strategist. Analyze video transcripts and provide actionable insights.

You MUST respond with ONLY valid JSON (no markdown, no code blocks, no explanation).

Output format (STRICT):
{
  "verdict": "REPEAT" | "MODIFY" | "STOP",
  "why": ["reason 1", "reason 2", "reason 3"],
  "next_action": "single clear action",
  "labels": {
    "hook_type": "QUESTION" | "BOLD_CLAIM" | "STORY" | "PROBLEM_SOLUTION" | "OTHER",
    "format": "TALKING_HEAD" | "BROLL" | "MONTAGE" | "TEXT_ON_SCREEN" | "MIXED",
    "cta_timing": "EARLY" | "MID" | "LATE" | "NONE",
    "length_bucket": "<15" | "15-25" | "25-40" | "40+"
  },
  "cta_analysis": {
    "cta_detected": true | false,
    "cta_phrase": "the exact words used for the CTA, or null if none",
    "cta_position_percent": 0-100 | null,
    "cta_timing": "EARLY" | "MID" | "LATE" | "NONE",
    "cta_reasoning": "1-2 sentences explaining why this CTA placement is effective or ineffective for THIS specific video, considering the content type, audience retention patterns, and video length"
  },
  "recommendations": { ... verdict-specific, see below ... }
}

Rules:
- REPEAT: This works, do more like this
- MODIFY: Has potential but needs changes
- STOP: Not working, abandon this approach
- "why" must be 2-3 specific, data-driven bullets
- "next_action" must be one clear directive
- Classify hook, format, and length accurately

CTA Detection Rules:
- A CTA (Call to Action) is any moment the creator asks the viewer to do something: follow, subscribe, like, comment, share, check link in bio, save the video, turn on notifications, etc.
- Identify the EXACT phrase used (e.g. "follow me for more", "link in bio", "drop a comment below")
- Estimate where in the transcript the CTA appears as a percentage of total video duration
- CTA Timing Classification (MUST follow these brackets):
  - EARLY: CTA appears in the first 25% of the video
  - MID: CTA appears between 25% and 75% of the video
  - LATE: CTA appears in the last 25% of the video
  - NONE: No CTA detected in the video
- The cta_timing in "labels" MUST match the cta_timing in "cta_analysis"
- "cta_reasoning" must explain WHY the placement is good or bad for THIS specific video. Consider:
  - For tutorial/recipe content: is the CTA placed where viewers are most engaged or after they got the value?
  - For short videos (<15s): early CTAs can feel pushy, but viewers drop off fast
  - For longer videos (40+s): most viewers won't reach a late CTA, so earlier is usually better
  - For story-driven content: a mid-point CTA can break flow, so end-of-story placement may work better
  - Always reference the specific video length and content type in your reasoning

Instruction-Level Recommendations:
You MUST include a "recommendations" object. Its structure depends on the verdict:

If verdict = "REPEAT":
"recommendations": {
  "template_structure": { "hook_type": "the hook type that worked", "body_format": "the body format", "cta_timing_window": "when the CTA should go" },
  "hook_rewrites": ["rewrite 1 (same tone, improved clarity)", "rewrite 2 (different angle)", "rewrite 3 (punchy variant)"],
  "suggested_next_topic": "A specific topic angle to explore next, based on what worked"
}
- hook_rewrites: rewrite the opening hook from the transcript 3 different ways. Keep the same tone and target audience. Improve clarity and scroll-stopping power.
- suggested_next_topic: suggest a concrete next video topic that leverages the same winning formula.

If verdict = "MODIFY":
"recommendations": {
  "change_instructions": [{ "instruction": "Exact measurable change (e.g. 'Move CTA from 45s to 20-30s', 'Cut intro from 12s to 4s')", "reasoning": "Why this helps" }],
  "performance_delta": { "video_like_rate": <likes/views*100>, "creator_median_like_rate": <from creator context or null>, "delta_description": "X% below/above your median" }
}
- change_instructions: 1-3 specific, actionable changes with time codes or measurable targets. No vague advice.
- performance_delta: compare this video's like rate to the creator's median (provided in context). If no creator context, set creator_median_like_rate to null and delta_description to "Not enough prior data".

If verdict = "STOP":
"recommendations": {
  "pattern_explanation": "Clear 1-2 sentence explanation of WHY this content pattern fails",
  "cluster_failure_reason": "What specific combination (hook + format + length) is underperforming and why",
  "suggested_alternative": { "format": "one of TALKING_HEAD|BROLL|MONTAGE|TEXT_ON_SCREEN|MIXED", "hook_type": "one of QUESTION|BOLD_CLAIM|STORY|PROBLEM_SOLUTION|OTHER", "length_bucket": "one of <15|15-25|25-40|40+", "reasoning": "Why this alternative would work better" }
}
- Use creator context (if available) to suggest the alternative that actually works for this creator.
- If no creator context, suggest based on general TikTok best practices.`;

export interface CreatorContext {
  medianLikeRate: number | null;
  bestHookType: string | null;
  bestLengthBucket: string | null;
  analyzedCount: number;
}

export async function generateInsights(
  transcript: string,
  videoMeta?: {
    duration_s: number;
    views: number;
    likes: number;
    comments: number;
  },
  creatorContext?: CreatorContext
): Promise<Insight> {
  if (!KIMI_API_KEY) {
    throw new Error("KIMI_API_KEY is not configured");
  }

  const userPrompt = buildUserPrompt(transcript, videoMeta, creatorContext);

  console.log("[Kimi] Generating insights...");

  try {
    // First attempt
    const rawResponse = await callKimiAPI(userPrompt);
    const parsed = parseAndValidate(rawResponse);
    return parsed;
  } catch (error) {
    console.warn("[Kimi] First attempt failed, trying repair...", error);

    // Repair attempt
    try {
      const repairPrompt = `The previous response was invalid. Here it is:

${error instanceof Error && error.message.includes("JSON") ? error.message : "Invalid format"}

Please fix it and return ONLY valid JSON matching the exact schema (no markdown, no explanation).`;

      const repairedResponse = await callKimiAPI(repairPrompt);
      const parsed = parseAndValidate(repairedResponse);
      return parsed;
    } catch (repairError) {
      console.error("[Kimi] Repair failed:", repairError);
      throw new Error(`Failed to generate valid insights after retry: ${repairError}`);
    }
  }
}

async function callKimiAPI(userMessage: string): Promise<string> {
  const response = await fetch(KIMI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshot-v1-8k",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Invalid response structure from Kimi API");
  }

  const content = data.choices[0].message.content;
  return content;
}

function parseAndValidate(rawResponse: string): Insight {
  // Remove markdown code blocks if present
  let cleaned = rawResponse.trim();

  // Remove ```json and ``` wrappers
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Try to extract JSON if there's extra text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  // Parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`JSON parse error: ${error}. Raw response: ${rawResponse.substring(0, 500)}`);
  }

  // Validate with Zod
  const result = InsightSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map((e) => `${String(e.path?.join(".") ?? "")}: ${e.message}`).join(", ");
    throw new Error(`Validation error: ${errors}. Parsed JSON: ${JSON.stringify(parsed, null, 2)}`);
  }

  return result.data;
}

function buildUserPrompt(
  transcript: string,
  videoMeta?: {
    duration_s: number;
    views: number;
    likes: number;
    comments: number;
  },
  creatorContext?: CreatorContext
): string {
  let prompt = `Analyze this TikTok video transcript:

"${transcript}"
`;

  if (videoMeta) {
    const engagementRate = videoMeta.views > 0 ? (videoMeta.likes / videoMeta.views) * 100 : 0;

    prompt += `
Video metrics:
- Duration: ${videoMeta.duration_s}s
- Views: ${videoMeta.views.toLocaleString()}
- Likes: ${videoMeta.likes.toLocaleString()}
- Comments: ${videoMeta.comments}
- Engagement rate: ${engagementRate.toFixed(2)}%
`;
  }

  if (creatorContext && creatorContext.analyzedCount > 0) {
    prompt += `
Creator context (for comparison and recommendations):
- Median like rate: ${creatorContext.medianLikeRate !== null ? creatorContext.medianLikeRate.toFixed(2) + "%" : "N/A"} (based on ${creatorContext.analyzedCount} analyzed videos)
- Best performing hook type: ${creatorContext.bestHookType || "N/A"} (from REPEAT videos)
- Best performing length: ${creatorContext.bestLengthBucket || "N/A"} (from REPEAT videos)
`;
  } else {
    prompt += `
Creator context: No prior analyzed videos available. Base recommendations on general TikTok best practices.
`;
  }

  prompt += `
Provide insights in STRICT JSON format (no markdown):`;

  return prompt;
}

// --- Multimodal Analysis (GPT-4o with frames) ---

const MultimodalInsightSchema = z.object({
  verdict: z.enum(["REPEAT", "MODIFY", "STOP"]),
  why: z.array(z.string()).min(2).max(3),
  next_action: z.string().min(1),
  labels: InsightLabelsSchema,
  cta_analysis: CTAAnalysisSchema,
  recommendations: RecommendationsSchema,
  visual_notes: z.array(z.string()).max(5).optional(),
});

export type MultimodalInsight = z.infer<typeof MultimodalInsightSchema>;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MULTIMODAL_SYSTEM_PROMPT = `You are a TikTok content strategist. Analyze video transcripts AND visual keyframes to provide actionable insights.

You MUST respond with ONLY valid JSON (no markdown, no code blocks, no explanation).

Output format (STRICT):
{
  "verdict": "REPEAT" | "MODIFY" | "STOP",
  "why": ["reason 1", "reason 2", "reason 3"],
  "next_action": "single clear action",
  "labels": {
    "hook_type": "QUESTION" | "BOLD_CLAIM" | "STORY" | "PROBLEM_SOLUTION" | "OTHER",
    "format": "TALKING_HEAD" | "BROLL" | "MONTAGE" | "TEXT_ON_SCREEN" | "MIXED",
    "cta_timing": "EARLY" | "MID" | "LATE" | "NONE",
    "length_bucket": "<15" | "15-25" | "25-40" | "40+"
  },
  "cta_analysis": {
    "cta_detected": true | false,
    "cta_phrase": "the exact words used for the CTA, or null if none",
    "cta_position_percent": 0-100 | null,
    "cta_timing": "EARLY" | "MID" | "LATE" | "NONE",
    "cta_reasoning": "1-2 sentences explaining why this CTA placement is effective or ineffective for THIS specific video, considering the content type, audience retention patterns, and video length"
  },
  "recommendations": { ... verdict-specific, see below ... },
  "visual_notes": ["note about visual element 1", "note about visual element 2"]
}

Rules:
- REPEAT: This format/style is working well, do more like this
- MODIFY: Has potential but needs changes
- STOP: Not working, abandon this approach
- "why" must be 2-3 specific, data-driven bullets
- "next_action" must be one clear directive
- "visual_notes" should describe 1-2 key visual patterns: lighting, text overlays, framing, transitions, b-roll usage, energy level
- Classify hook, format, and length accurately

CTA Detection Rules:
- A CTA (Call to Action) is any moment the creator asks the viewer to do something: follow, subscribe, like, comment, share, check link in bio, save the video, turn on notifications, etc.
- Identify the EXACT phrase used (e.g. "follow me for more", "link in bio", "drop a comment below")
- Estimate where in the transcript the CTA appears as a percentage of total video duration
- CTA Timing Classification (MUST follow these brackets):
  - EARLY: CTA appears in the first 25% of the video
  - MID: CTA appears between 25% and 75% of the video
  - LATE: CTA appears in the last 25% of the video
  - NONE: No CTA detected in the video
- The cta_timing in "labels" MUST match the cta_timing in "cta_analysis"
- "cta_reasoning" must explain WHY the placement is good or bad for THIS specific video. Consider:
  - For tutorial/recipe content: is the CTA placed where viewers are most engaged or after they got the value?
  - For short videos (<15s): early CTAs can feel pushy, but viewers drop off fast
  - For longer videos (40+s): most viewers won't reach a late CTA, so earlier is usually better
  - For story-driven content: a mid-point CTA can break flow, so end-of-story placement may work better
  - Always reference the specific video length and content type in your reasoning

Instruction-Level Recommendations:
You MUST include a "recommendations" object. Its structure depends on the verdict:

If verdict = "REPEAT":
"recommendations": {
  "template_structure": { "hook_type": "the hook type that worked", "body_format": "the body format", "cta_timing_window": "when the CTA should go" },
  "hook_rewrites": ["rewrite 1 (same tone, improved clarity)", "rewrite 2 (different angle)", "rewrite 3 (punchy variant)"],
  "suggested_next_topic": "A specific topic angle to explore next, based on what worked"
}
- hook_rewrites: rewrite the opening hook from the transcript 3 different ways. Keep the same tone and target audience. Improve clarity and scroll-stopping power.
- suggested_next_topic: suggest a concrete next video topic that leverages the same winning formula.

If verdict = "MODIFY":
"recommendations": {
  "change_instructions": [{ "instruction": "Exact measurable change (e.g. 'Move CTA from 45s to 20-30s', 'Cut intro from 12s to 4s')", "reasoning": "Why this helps" }],
  "performance_delta": { "video_like_rate": <likes/views*100>, "creator_median_like_rate": <from creator context or null>, "delta_description": "X% below/above your median" }
}
- change_instructions: 1-3 specific, actionable changes with time codes or measurable targets. No vague advice.
- performance_delta: compare this video's like rate to the creator's median (provided in context). If no creator context, set creator_median_like_rate to null and delta_description to "Not enough prior data".

If verdict = "STOP":
"recommendations": {
  "pattern_explanation": "Clear 1-2 sentence explanation of WHY this content pattern fails",
  "cluster_failure_reason": "What specific combination (hook + format + length) is underperforming and why",
  "suggested_alternative": { "format": "one of TALKING_HEAD|BROLL|MONTAGE|TEXT_ON_SCREEN|MIXED", "hook_type": "one of QUESTION|BOLD_CLAIM|STORY|PROBLEM_SOLUTION|OTHER", "length_bucket": "one of <15|15-25|25-40|40+", "reasoning": "Why this alternative would work better" }
}
- Use creator context (if available) to suggest the alternative that actually works for this creator.
- If no creator context, suggest based on general TikTok best practices.`;

export async function generateMultimodalInsights(
  transcript: string,
  frameUrls: string[],
  videoMeta?: {
    caption?: string;
    duration_s: number;
    views: number;
    likes: number;
    comments: number;
  },
  creatorContext?: CreatorContext
): Promise<MultimodalInsight> {
  if (!OPENAI_API_KEY) {
    console.warn("[Insights] No OPENAI_API_KEY, falling back to text-only Kimi");
    const textResult = await generateInsights(transcript, videoMeta ? {
      duration_s: videoMeta.duration_s,
      views: videoMeta.views,
      likes: videoMeta.likes,
      comments: videoMeta.comments,
    } : undefined, creatorContext);
    return { ...textResult, visual_notes: undefined };
  }

  const engagementRate = videoMeta && videoMeta.views > 0
    ? (videoMeta.likes / videoMeta.views) * 100
    : 0;

  // Build message content array with text + images
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Analyze this TikTok video.

Transcript: "${transcript.substring(0, 2000)}"

Caption: "${videoMeta?.caption || "N/A"}"

Metrics:
- Duration: ${videoMeta?.duration_s || "unknown"}s
- Views: ${videoMeta?.views?.toLocaleString() || "N/A"}
- Likes: ${videoMeta?.likes?.toLocaleString() || "N/A"}
- Comments: ${videoMeta?.comments || "N/A"}
- Engagement: ${engagementRate.toFixed(2)}%

${creatorContext && creatorContext.analyzedCount > 0
  ? `Creator context (for comparison and recommendations):
- Median like rate: ${creatorContext.medianLikeRate !== null ? creatorContext.medianLikeRate.toFixed(2) + "%" : "N/A"} (based on ${creatorContext.analyzedCount} analyzed videos)
- Best performing hook type: ${creatorContext.bestHookType || "N/A"} (from REPEAT videos)
- Best performing length: ${creatorContext.bestLengthBucket || "N/A"} (from REPEAT videos)`
  : "Creator context: No prior analyzed videos available. Base recommendations on general TikTok best practices."}

Below are evenly-spaced keyframes from the video. Analyze the visual style, production quality, framing, text overlays, and any visual patterns.

Return STRICT JSON only.`,
    },
  ];

  // Add frame images (capped, detail: low to reduce cost)
  for (const url of frameUrls.slice(0, MAX_FRAMES_PER_VIDEO)) {
    content.push({
      type: "image_url",
      image_url: { url, detail: "low" },
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: MULTIMODAL_SYSTEM_PROMPT },
          { role: "user", content },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Insights] GPT-4o error, falling back to Kimi:", errorText);
      const textResult = await generateInsights(transcript, videoMeta ? {
        duration_s: videoMeta.duration_s,
        views: videoMeta.views,
        likes: videoMeta.likes,
        comments: videoMeta.comments,
      } : undefined, creatorContext);
      return { ...textResult, visual_notes: undefined };
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    const parsed = JSON.parse(rawContent);
    const result = MultimodalInsightSchema.safeParse(parsed);

    if (!result.success) {
      console.warn("[Insights] Multimodal validation failed:", result.error.issues);
      const textResult = await generateInsights(transcript, videoMeta ? {
        duration_s: videoMeta.duration_s,
        views: videoMeta.views,
        likes: videoMeta.likes,
        comments: videoMeta.comments,
      } : undefined, creatorContext);
      return { ...textResult, visual_notes: undefined };
    }

    return result.data;
  } catch (error) {
    console.error("[Insights] Multimodal analysis error:", error);
    const textResult = await generateInsights(transcript, videoMeta ? {
      duration_s: videoMeta.duration_s,
      views: videoMeta.views,
      likes: videoMeta.likes,
      comments: videoMeta.comments,
    } : undefined, creatorContext);
    return { ...textResult, visual_notes: undefined };
  }
}

// Helper to determine length bucket from duration
export function getLengthBucket(durationSeconds: number): InsightLabels["length_bucket"] {
  if (durationSeconds < 15) return "<15";
  if (durationSeconds < 25) return "15-25";
  if (durationSeconds < 40) return "25-40";
  return "40+";
}
