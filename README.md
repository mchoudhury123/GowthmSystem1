# Growthm - TikTok Content Intelligence

Week 1 Demo Build: Premium dark dashboard for content strategy insights.

## Features

✅ **Premium Dark UI** - Gold/champagne accents on deep charcoal background
✅ **Decision Dashboard** - Focus on actionable insights, not charts
✅ **Video Intelligence** - REPEAT/MODIFY/STOP verdicts with reasoning
✅ **Pattern Detection** - Identify winning formulas from your content
✅ **Smart Recommendations** - AI-powered next-post suggestions
✅ **Demo Mode** - Works instantly with mock data
✅ **Database Ready** - Postgres schema + API routes ready for production data

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (Postgres)
- **AI**: Anthropic Claude / OpenAI GPT (optional, mocked if not configured)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run in Demo Mode (No Setup Required)

```bash
# Create .env.local with demo mode enabled
echo "DEMO_MODE=true" > .env.local

# Start the dev server
npm run dev
```

Visit `http://localhost:3000` - the dashboard will load with mock data instantly.

## Production Setup (with Database)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to initialize (~2 minutes)

### 2. Run Database Schema

In the Supabase SQL Editor, run these files in order:

1. `supabase/schema.sql` - Creates tables and functions
2. `supabase/seed.sql` - Loads demo data (1 creator, 30 videos, 15 insights)

### 3. Configure Environment Variables

Create `.env.local`:

```bash
# Required: Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Required: App Mode
DEMO_MODE=false

# Optional: LLM API Keys (for real analysis)
# If omitted, /api/videos/:id/run-analysis returns mock insights
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
```

**Finding Your Supabase Keys:**
- Dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY` = `service_role` `secret` key ⚠️ Never expose this in client code

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Structure

```
├── app/
│   ├── (dashboard)/          # Dashboard layout + pages
│   │   ├── overview/         # Main dashboard
│   │   ├── videos/           # Video library with modal detail
│   │   ├── patterns/         # Winning patterns analysis
│   │   └── recommendations/  # Next-post suggestions
│   ├── api/                  # Next.js API routes
│   │   ├── creators/         # POST /api/creators
│   │   │   └── [id]/
│   │   │       ├── dashboard/     # GET dashboard data
│   │   │       └── generate-weekly/ # POST generate summary
│   │   └── videos/
│   │       └── [id]/
│   │           └── run-analysis/  # POST analyze transcript
│   ├── globals.css           # Tailwind + theme tokens
│   └── layout.tsx
├── components/
│   ├── ui/                   # Reusable UI components
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Modal.tsx
│   ├── Sidebar.tsx           # Navigation sidebar
│   └── DevTools.tsx          # Dev-only analysis controls
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── supabaseClient.ts     # Browser Supabase client
│   ├── supabaseServer.ts     # Server Supabase client
│   ├── demoMode.ts           # Demo mode utilities
│   ├── llm.ts                # LLM analysis (Claude/GPT)
│   ├── api.ts                # API client functions
│   └── mock/
│       └── data.ts           # Mock data for demo mode
├── supabase/
│   ├── schema.sql            # Database schema
│   └── seed.sql              # Demo data seed
├── tailwind.config.ts        # Tailwind theme (gold/champagne)
└── package.json
```

## API Routes

### `POST /api/creators`
Create a new creator.

**Body:**
```json
{
  "handle": "@username",
  "niche": "productivity" // optional
}
```

**Response:** Creator object with ID

---

### `GET /api/creators/:id/dashboard`
Fetch all dashboard data for a creator.

**Response:**
```json
{
  "creator": { "id": "...", "handle": "...", ... },
  "weekly_summary": { "do_more": [...], "stop_doing": [...] },
  "recent_videos": [ { "id": "...", "insight": {...} }, ... ]
}
```

---

### `GET /api/videos/:id`
Fetch a single video with its insight.

**Response:**
```json
{
  "id": "...",
  "caption": "...",
  "insight": {
    "verdict": "REPEAT",
    "why": ["...", "..."],
    "next_action": "...",
    "labels": { "hook_type": "...", ... }
  }
}
```

---

### `POST /api/videos/:id/run-analysis`
Analyze a video transcript and generate/update insight.

**Body:**
```json
{
  "transcriptText": "Hey everyone, today I want to talk about..."
}
```

**Response:**
```json
{
  "success": true,
  "insight": { "verdict": "REPEAT", ... }
}
```

**Note:** If no LLM API keys configured, returns mock analysis based on heuristics.

---

### `POST /api/creators/:id/generate-weekly`
Generate weekly summary from existing video insights.

**Response:**
```json
{
  "success": true,
  "summary": {
    "do_more": ["Question hooks - 70% success", ...],
    "stop_doing": ["Text content - underperforms", ...]
  }
}
```

## Development Tools

When `NODE_ENV=development`, a `DevTools` component appears on pages:

1. **Run Analysis** - Analyze any video by ID + transcript
2. **Generate Weekly** - Create summary from insights

Import and use:
```tsx
import DevTools from "@/components/DevTools";

// In your page
<DevTools creatorId="550e8400-..." />
```

## Insight JSON Schema

All video insights follow this strict schema:

```typescript
{
  verdict: "REPEAT" | "MODIFY" | "STOP",
  why: string[],  // 2-3 bullet points
  next_action: string,  // Single actionable directive
  labels: {
    hook_type: "QUESTION" | "BOLD_CLAIM" | "STORY" | "PROBLEM_SOLUTION" | "OTHER",
    format: "TALKING_HEAD" | "BROLL" | "MONTAGE" | "TEXT_ON_SCREEN" | "MIXED",
    cta_timing: "EARLY" | "MID" | "LATE" | "NONE",
    length_bucket: "<15" | "15-25" | "25-40" | "40+"
  }
}
```

## Design System

### Colors (Tailwind Classes)

- **Background**: `bg-background` (#0a0a0a)
- **Charcoal**: `bg-charcoal` (#141414), `bg-charcoal-light` (#1a1a1a), `bg-charcoal-lighter` (#242424)
- **Gold**: `text-gold` (#d4af37), `bg-gold`, `border-gold`
- **Champagne**: `text-champagne` (#f7e7ce)
- **Accents**: `text-accent-green`, `text-accent-red`, `text-accent-amber`

### Verdict Colors

- **REPEAT** → Green (`text-accent-green`, `bg-accent-green/10`)
- **MODIFY** → Amber (`text-accent-amber`, `bg-accent-amber/10`)
- **STOP** → Red (`text-accent-red`, `bg-accent-red/10`)

## Week 1 Limitations (By Design)

- ❌ No authentication (week 2+)
- ❌ No TikTok OAuth or scraping (week 2+)
- ❌ No charts/graphs (decision-focused, not analytics)
- ❌ No real-time data sync
- ✅ Manual video upload/analysis via API routes
- ✅ LLM analysis optional (mocked if keys missing)

## Next Steps (Week 2+)

1. Add Supabase Auth + user sessions
2. Build TikTok scraper (unofficial API or web scraping)
3. Add video upload flow in UI
4. Implement automatic weekly summary generation
5. Add pattern trend tracking over time
6. Build recommendation engine improvements

## Database Schema Overview

**Tables:**
- `creators` - TikTok creator accounts
- `videos` - Video metadata (views, likes, duration, etc.)
- `video_insights` - AI analysis results (1:1 with videos)
- `weekly_summary` - Aggregated weekly insights per creator

See `supabase/schema.sql` for full details.

## Troubleshooting

**Issue**: Dashboard shows empty state
**Fix**: Check `DEMO_MODE=true` in `.env.local`, or ensure database is seeded

**Issue**: API routes return 500 errors
**Fix**: Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

**Issue**: Analysis returns mock data even with API keys
**Fix**: Ensure `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set without typos

**Issue**: Type errors on build
**Fix**: Run `npm install` and restart TypeScript server

## License

Proprietary - Week 1 Demo Build

---

**Built with Claude Code** 🚀
