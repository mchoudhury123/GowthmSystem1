import { Creator, DashboardData, Pattern, Video, VideoInsight, WeeklySummary } from "@/lib/types";

const MOCK_CREATOR_ID = "550e8400-e29b-41d4-a716-446655440000";

export const mockCreator: Creator = {
  id: MOCK_CREATOR_ID,
  handle: "@contentcreator",
  niche: "productivity",
  created_at: new Date().toISOString(),
};

export const mockInsights: VideoInsight[] = [
  {
    id: "insight-1",
    video_id: "video-1",
    verdict: "REPEAT",
    why: [
      "Hook question format drives 3x more retention",
      "Under 20s keeps viewer attention peak",
      "Early CTA placement converts better"
    ],
    next_action: "Create 3 more videos with question hooks under 20 seconds",
    labels: {
      hook_type: "QUESTION",
      format: "TALKING_HEAD",
      cta_timing: "EARLY",
      length_bucket: "<15"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
  {
    id: "insight-2",
    video_id: "video-2",
    verdict: "REPEAT",
    why: [
      "Bold claim hook stops scrolling immediately",
      "B-roll montage style matches your best performers",
      "Mid-video CTA feels natural in this format"
    ],
    next_action: "Double down on bold claims + b-roll montage combos",
    labels: {
      hook_type: "BOLD_CLAIM",
      format: "BROLL",
      cta_timing: "MID",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "insight-3",
    video_id: "video-3",
    verdict: "MODIFY",
    why: [
      "Story hook works but needs faster pacing",
      "40+ seconds loses 60% of viewers",
      "Late CTA misses engagement window"
    ],
    next_action: "Trim story hooks to 15-20s and move CTA earlier",
    labels: {
      hook_type: "STORY",
      format: "MIXED",
      cta_timing: "LATE",
      length_bucket: "40+"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: "insight-4",
    video_id: "video-4",
    verdict: "STOP",
    why: [
      "Problem-solution format underperforms in your niche",
      "Text-on-screen style gets low engagement",
      "No CTA means no conversion"
    ],
    next_action: "Abandon this format entirely - stick to talking head",
    labels: {
      hook_type: "PROBLEM_SOLUTION",
      format: "TEXT_ON_SCREEN",
      cta_timing: "NONE",
      length_bucket: "25-40"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    id: "insight-5",
    video_id: "video-5",
    verdict: "REPEAT",
    why: [
      "Question hooks proven to be your top performer",
      "Talking head builds authentic connection",
      "Early CTA capitalizes on peak attention"
    ],
    next_action: "Make this your default template for next 5 videos",
    labels: {
      hook_type: "QUESTION",
      format: "TALKING_HEAD",
      cta_timing: "EARLY",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: "insight-6",
    video_id: "video-6",
    verdict: "MODIFY",
    why: [
      "Bold claim is strong but video runs too long",
      "Montage could work with tighter editing"
    ],
    next_action: "Keep hook, cut 15 seconds from middle section",
    labels: {
      hook_type: "BOLD_CLAIM",
      format: "MONTAGE",
      cta_timing: "MID",
      length_bucket: "25-40"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
  },
  {
    id: "insight-7",
    video_id: "video-7",
    verdict: "STOP",
    why: [
      "Generic hook fails to differentiate",
      "Mixed format feels disjointed"
    ],
    next_action: "Stop experimenting with mixed styles - pick one format",
    labels: {
      hook_type: "OTHER",
      format: "MIXED",
      cta_timing: "LATE",
      length_bucket: "40+"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: "insight-8",
    video_id: "video-8",
    verdict: "REPEAT",
    why: [
      "Question + talking head = proven winner",
      "15-20s sweet spot confirmed again"
    ],
    next_action: "Batch record 10 more question-hook videos",
    labels: {
      hook_type: "QUESTION",
      format: "TALKING_HEAD",
      cta_timing: "EARLY",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: "insight-9",
    video_id: "video-9",
    verdict: "REPEAT",
    why: [
      "Bold claim hooks perform consistently well",
      "B-roll adds production value without losing authenticity"
    ],
    next_action: "Schedule 2 bold claim videos per week",
    labels: {
      hook_type: "BOLD_CLAIM",
      format: "BROLL",
      cta_timing: "MID",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
  {
    id: "insight-10",
    video_id: "video-10",
    verdict: "MODIFY",
    why: [
      "Story hook has potential but pacing is off",
      "Needs tighter editing"
    ],
    next_action: "Re-edit with 30% faster cuts",
    labels: {
      hook_type: "STORY",
      format: "TALKING_HEAD",
      cta_timing: "MID",
      length_bucket: "25-40"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: "insight-11",
    video_id: "video-11",
    verdict: "REPEAT",
    why: [
      "Question format continues to dominate",
      "Viewers love quick, actionable content"
    ],
    next_action: "Keep question hooks as primary strategy",
    labels: {
      hook_type: "QUESTION",
      format: "TALKING_HEAD",
      cta_timing: "EARLY",
      length_bucket: "<15"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
  },
  {
    id: "insight-12",
    video_id: "video-12",
    verdict: "STOP",
    why: [
      "Problem-solution doesn't resonate with your audience",
      "Text-based content underperforms"
    ],
    next_action: "Stick to face-to-camera content",
    labels: {
      hook_type: "PROBLEM_SOLUTION",
      format: "TEXT_ON_SCREEN",
      cta_timing: "NONE",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  },
  {
    id: "insight-13",
    video_id: "video-13",
    verdict: "REPEAT",
    why: [
      "Bold claims drive clicks and shares",
      "B-roll montage style scales well"
    ],
    next_action: "Build a library of b-roll for faster production",
    labels: {
      hook_type: "BOLD_CLAIM",
      format: "BROLL",
      cta_timing: "MID",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
  },
  {
    id: "insight-14",
    video_id: "video-14",
    verdict: "MODIFY",
    why: [
      "Question hook is good but delivery feels rushed",
      "Slow down pace slightly"
    ],
    next_action: "Re-record with 10% slower delivery",
    labels: {
      hook_type: "QUESTION",
      format: "TALKING_HEAD",
      cta_timing: "EARLY",
      length_bucket: "<15"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
  {
    id: "insight-15",
    video_id: "video-15",
    verdict: "REPEAT",
    why: [
      "Question + talking head continues to win",
      "15-20s length is the goldilocks zone"
    ],
    next_action: "Make this your default daily format",
    labels: {
      hook_type: "QUESTION",
      format: "TALKING_HEAD",
      cta_timing: "EARLY",
      length_bucket: "15-25"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
];

export const mockVideos: Video[] = [
  {
    id: "video-1",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000001",
    caption: "Ever wonder why you can't focus? Here's the truth nobody tells you...",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+1",
    duration_s: 14,
    views: 125000,
    likes: 8200,
    comments: 340,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    insight: mockInsights[0],
  },
  {
    id: "video-2",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000002",
    caption: "I built a $10k/mo side hustle in 90 days. Here's the blueprint.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+2",
    duration_s: 19,
    views: 98000,
    likes: 7100,
    comments: 290,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    insight: mockInsights[1],
  },
  {
    id: "video-3",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000003",
    caption: "The story of how I went from broke to 6 figures changed everything...",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+3",
    duration_s: 43,
    views: 45000,
    likes: 2300,
    comments: 120,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    insight: mockInsights[2],
  },
  {
    id: "video-4",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000004",
    caption: "Problem: You're wasting time. Solution: This productivity hack.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+4",
    duration_s: 31,
    views: 18000,
    likes: 890,
    comments: 45,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    insight: mockInsights[3],
  },
  {
    id: "video-5",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000005",
    caption: "What if I told you morning routines are overrated?",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+5",
    duration_s: 17,
    views: 142000,
    likes: 11200,
    comments: 520,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    insight: mockInsights[4],
  },
  {
    id: "video-6",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000006",
    caption: "99% of productivity advice is wrong. Here's why.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+6",
    duration_s: 34,
    views: 67000,
    likes: 4200,
    comments: 180,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    insight: mockInsights[5],
  },
  {
    id: "video-7",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000007",
    caption: "Some random thoughts about productivity and life balance...",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+7",
    duration_s: 47,
    views: 12000,
    likes: 520,
    comments: 32,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    insight: mockInsights[6],
  },
  {
    id: "video-8",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000008",
    caption: "Should you quit your job? Ask yourself this ONE question first.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+8",
    duration_s: 16,
    views: 156000,
    likes: 13400,
    comments: 670,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    insight: mockInsights[7],
  },
  {
    id: "video-9",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000009",
    caption: "Nobody talks about this, but it's the #1 productivity killer.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+9",
    duration_s: 21,
    views: 89000,
    likes: 6700,
    comments: 310,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
    insight: mockInsights[8],
  },
  {
    id: "video-10",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000010",
    caption: "The day I realized hard work isn't enough...",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+10",
    duration_s: 29,
    views: 51000,
    likes: 3200,
    comments: 140,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    insight: mockInsights[9],
  },
  {
    id: "video-11",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000011",
    caption: "Why do successful people wake up at 5am?",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+11",
    duration_s: 13,
    views: 178000,
    likes: 15600,
    comments: 890,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
    insight: mockInsights[10],
  },
  {
    id: "video-12",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000012",
    caption: "Problem: No time. Solution: Time blocking.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+12",
    duration_s: 22,
    views: 23000,
    likes: 1100,
    comments: 67,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    insight: mockInsights[11],
  },
  {
    id: "video-13",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000013",
    caption: "This ONE hack doubled my output overnight.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+13",
    duration_s: 18,
    views: 112000,
    likes: 8900,
    comments: 410,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
    insight: mockInsights[12],
  },
  {
    id: "video-14",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000014",
    caption: "Are you making this common productivity mistake?",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+14",
    duration_s: 12,
    views: 94000,
    likes: 7200,
    comments: 320,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    insight: mockInsights[13],
  },
  {
    id: "video-15",
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: "7123456789000000015",
    caption: "How do you stay motivated? Here's the real answer.",
    thumb_url: "https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+15",
    duration_s: 19,
    views: 167000,
    likes: 14100,
    comments: 720,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    insight: mockInsights[14],
  },
  // Add 15 more videos without insights (pending analysis)
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `video-${16 + i}`,
    creator_id: MOCK_CREATOR_ID,
    tiktok_id: `712345678900000${16 + i}`,
    caption: `Video caption ${16 + i} - analysis pending`,
    thumb_url: `https://via.placeholder.com/300x400/1a1a1a/d4af37?text=Video+${16 + i}`,
    duration_s: 15 + Math.floor(Math.random() * 25),
    views: Math.floor(Math.random() * 100000) + 10000,
    likes: Math.floor(Math.random() * 5000) + 500,
    comments: Math.floor(Math.random() * 200) + 20,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * (16 + i)).toISOString(),
  })),
];

export const mockWeeklySummary: WeeklySummary = {
  id: "summary-1",
  creator_id: MOCK_CREATOR_ID,
  do_more: [
    "Question hooks - 70% of your top performers use them",
    "Talking head format - authentic connection drives engagement",
    "15-20 second videos - sweet spot for retention and completion",
    "Early CTAs - capture attention in first 5 seconds",
  ],
  stop_doing: [
    "Text-on-screen content - underperforms by 65%",
    "Videos over 30 seconds - lose majority of viewers",
    "Problem-solution format - doesn't resonate with your audience",
  ],
  created_at: new Date().toISOString(),
};

export const mockPatterns: Pattern[] = [
  {
    id: "pattern-1",
    title: "Question Hook + Talking Head",
    description: "Opens with direct question, face-to-camera delivery",
    count: 8,
    success_rate: 87,
  },
  {
    id: "pattern-2",
    title: "Bold Claim + B-Roll",
    description: "Provocative statement backed by visual montage",
    count: 5,
    success_rate: 76,
  },
  {
    id: "pattern-3",
    title: "Under 20 Seconds",
    description: "Quick, punchy content that respects viewer time",
    count: 12,
    success_rate: 82,
  },
  {
    id: "pattern-4",
    title: "Early CTA Placement",
    description: "Call-to-action within first 5-7 seconds",
    count: 9,
    success_rate: 79,
  },
  {
    id: "pattern-5",
    title: "Single-Topic Focus",
    description: "One clear idea, fully explored in short form",
    count: 11,
    success_rate: 84,
  },
  {
    id: "pattern-6",
    title: "Authentic Energy",
    description: "High energy without feeling fake or forced",
    count: 13,
    success_rate: 88,
  },
];

export const mockDashboardData: DashboardData = {
  creator: mockCreator,
  weekly_summary: mockWeeklySummary,
  recent_videos: mockVideos.slice(0, 15),
};

export const mockRecommendation = {
  title: "Your Next Post Should...",
  recommendation: "Create a question-hook video about a common productivity myth",
  reasoning: [
    "Question hooks are your #1 performing format (87% success rate)",
    "Myth-busting content drives shares and comments",
    "Keep it under 18 seconds for maximum retention",
    "Use talking head format - your audience craves authenticity",
  ],
  template: {
    hook: '"Is [common belief] actually killing your productivity?"',
    format: "Talking head, direct-to-camera",
    length: "15-18 seconds",
    cta: "Early (within first 5 seconds)",
  },
};
