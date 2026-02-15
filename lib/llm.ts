// LLM Integration for Video Analysis
// Supports Anthropic Claude and OpenAI GPT

import { InsightLabels, Verdict, CTAAnalysis } from "./types";

const SYSTEM_PROMPT = `You are a TikTok content strategist analyzing video transcripts.
Your job is to provide actionable insights for creators.

For each video transcript, return a JSON object with EXACTLY this structure:
{
  "verdict": "REPEAT" | "MODIFY" | "STOP",
  "why": ["reason 1", "reason 2", "reason 3"],
  "next_action": "single actionable next step",
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
    "cta_reasoning": "1-2 sentences explaining why this CTA placement is effective or ineffective for THIS specific video"
  }
}

Rules:
- REPEAT: This format/style is working well, do more
- MODIFY: Has potential but needs adjustments
- STOP: Not working, abandon this approach
- Be specific and actionable in "why" bullets
- "next_action" should be a single clear directive

CTA Detection Rules:
- A CTA (Call to Action) is any moment the creator asks the viewer to do something: follow, subscribe, like, comment, share, check link in bio, save the video, etc.
- Identify the EXACT phrase used (e.g. "follow me for more", "link in bio")
- Estimate where in the transcript the CTA appears as a percentage of total video duration
- CTA Timing Classification (MUST follow these brackets):
  - EARLY: CTA appears in the first 25% of the video (0-25%)
  - MID: CTA appears between 25% and 75% of the video
  - LATE: CTA appears in the last 25% of the video (75-100%)
  - NONE: No CTA detected in the video
- The cta_timing in "labels" MUST match the cta_timing in "cta_analysis"
- "cta_reasoning" must explain WHY the placement is good or bad for THIS specific video, referencing the content type, video length, and audience retention`;

interface AnalysisResult {
  verdict: Verdict;
  why: string[];
  next_action: string;
  labels: InsightLabels;
  cta_analysis: CTAAnalysis;
}

export async function analyzeTranscript(
  transcript: string,
  videoData?: {
    duration_s: number;
    views: number;
    likes: number;
    comments: number;
  }
): Promise<AnalysisResult> {
  // Check for API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // If no API keys, return mock analysis
  if (!anthropicKey && !openaiKey) {
    console.log("No LLM API keys found. Returning mock analysis.");
    return generateMockAnalysis(transcript, videoData);
  }

  // Try Anthropic first, fallback to OpenAI
  if (anthropicKey) {
    return analyzeWithAnthropic(transcript, videoData);
  } else {
    return analyzeWithOpenAI(transcript, videoData);
  }
}

async function analyzeWithAnthropic(
  transcript: string,
  videoData?: any
): Promise<AnalysisResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this TikTok video transcript and provide insights.

Transcript: "${transcript}"

${
  videoData
    ? `Video metrics:
- Duration: ${videoData.duration_s}s
- Views: ${videoData.views}
- Likes: ${videoData.likes}
- Comments: ${videoData.comments}`
    : ""
}

Return ONLY valid JSON, no other text.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse JSON from Anthropic response");
  }

  return JSON.parse(jsonMatch[0]);
}

async function analyzeWithOpenAI(
  transcript: string,
  videoData?: any
): Promise<AnalysisResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Analyze this TikTok video transcript and provide insights.

Transcript: "${transcript}"

${
  videoData
    ? `Video metrics:
- Duration: ${videoData.duration_s}s
- Views: ${videoData.views}
- Likes: ${videoData.likes}
- Comments: ${videoData.comments}`
    : ""
}

Return ONLY valid JSON, no other text.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

function generateMockAnalysis(
  transcript: string,
  videoData?: any
): AnalysisResult {
  // Simple heuristic-based mock analysis
  const transcriptLower = transcript.toLowerCase();

  // Determine hook type
  let hook_type: InsightLabels["hook_type"] = "OTHER";
  if (transcriptLower.includes("?") || transcriptLower.startsWith("what") || transcriptLower.startsWith("how") || transcriptLower.startsWith("why")) {
    hook_type = "QUESTION";
  } else if (transcriptLower.includes("secret") || transcriptLower.includes("truth") || transcriptLower.includes("nobody")) {
    hook_type = "BOLD_CLAIM";
  } else if (transcriptLower.includes("story") || transcriptLower.includes("when i") || transcriptLower.includes("the day")) {
    hook_type = "STORY";
  } else if (transcriptLower.includes("problem") || transcriptLower.includes("solution")) {
    hook_type = "PROBLEM_SOLUTION";
  }

  // Determine verdict based on simple heuristics
  let verdict: Verdict = "MODIFY";
  const hasGoodMetrics = videoData && videoData.views > 50000 && (videoData.likes / videoData.views) > 0.05;

  if (hook_type === "QUESTION" || hook_type === "BOLD_CLAIM") {
    verdict = hasGoodMetrics ? "REPEAT" : "MODIFY";
  } else if (hook_type === "PROBLEM_SOLUTION") {
    verdict = "STOP";
  }

  const duration = videoData?.duration_s || 20;
  const length_bucket: InsightLabels["length_bucket"] =
    duration < 15 ? "<15" : duration < 25 ? "15-25" : duration < 40 ? "25-40" : "40+";

  // CTA detection via keyword search
  const ctaKeywords = ["follow", "subscribe", "like", "comment", "share", "link in bio", "save this", "turn on notifications", "check out", "tap the"];
  const ctaMatch = ctaKeywords.find((kw) => transcriptLower.includes(kw));
  const ctaDetected = !!ctaMatch;

  // Estimate CTA position: find where the keyword appears as a % of transcript length
  let ctaPositionPercent: number | null = null;
  let ctaTiming: InsightLabels["cta_timing"] = "NONE";
  let ctaReasoning = "No CTA was detected in this video. Adding a clear call to action (e.g. 'follow for more') would help convert engaged viewers into followers.";

  if (ctaDetected && ctaMatch) {
    const ctaIndex = transcriptLower.indexOf(ctaMatch);
    ctaPositionPercent = Math.round((ctaIndex / transcriptLower.length) * 100);

    // Classify using percentage brackets
    if (ctaPositionPercent <= 25) {
      ctaTiming = "EARLY";
    } else if (ctaPositionPercent <= 75) {
      ctaTiming = "MID";
    } else {
      ctaTiming = "LATE";
    }

    // Generate reasoning based on timing and video length
    if (ctaTiming === "EARLY") {
      ctaReasoning = `CTA appears at ~${ctaPositionPercent}% of the video (first quarter). ${duration < 15 ? "For a short video, this can feel rushed — viewers haven't received value yet." : "Early placement captures viewers before drop-off, but may feel premature before delivering value."}`;
    } else if (ctaTiming === "MID") {
      ctaReasoning = `CTA appears at ~${ctaPositionPercent}% of the video (mid-section). ${duration > 40 ? "For a longer video, mid-placement is strategic — viewers who've watched this far are engaged and likely to act." : "Good placement that balances value delivery with viewer retention."}`;
    } else {
      ctaReasoning = `CTA appears at ~${ctaPositionPercent}% of the video (final quarter). ${duration > 40 ? `At ${duration}s, most TikTok viewers will have dropped off before reaching this point. Moving the CTA earlier would reach more viewers.` : "Late placement means only viewers who watch to the end will see it, reducing conversion potential."}`;
    }
  }

  return {
    verdict,
    why: [
      `${hook_type.replace(/_/g, " ")} hook detected in opening`,
      duration < 20 ? "Short format keeps attention" : "Could be tighter",
      hasGoodMetrics ? "Strong engagement metrics" : "Room for improvement in metrics",
    ],
    next_action:
      verdict === "REPEAT"
        ? `Create 3 more videos with ${hook_type.replace(/_/g, " ")} hooks`
        : verdict === "MODIFY"
        ? "Tighten pacing and strengthen hook"
        : "Try a different approach - this format isn't working",
    labels: {
      hook_type,
      format: "TALKING_HEAD",
      cta_timing: ctaTiming,
      length_bucket,
    },
    cta_analysis: {
      cta_detected: ctaDetected,
      cta_phrase: ctaMatch || null,
      cta_position_percent: ctaPositionPercent,
      cta_timing: ctaTiming,
      cta_reasoning: ctaReasoning,
    },
  };
}
