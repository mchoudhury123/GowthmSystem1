# Growthm Setup Guide

Follow these steps to get Growthm running on your machine.

## Option 1: Quick Demo (No Database)

**Time: 2 minutes**

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local`:
   ```bash
   DEMO_MODE=true
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` ✅

The dashboard will load with realistic mock data. Perfect for design review and UI testing.

---

## Option 2: Full Setup (With Database)

**Time: 15 minutes**

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Create Supabase Project

1. Go to **[supabase.com](https://supabase.com)** and sign up/login
2. Click **"New Project"**
3. Choose organization, project name, database password
4. Select region (pick closest to you)
5. Click **"Create new project"**
6. Wait ~2 minutes for database to provision ☕

### Step 3: Get Your API Keys

1. In Supabase dashboard, go to **Settings** (gear icon) → **API**
2. Copy these values:

   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` `public` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Create `.env.local`

Create a file called `.env.local` in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App Config
DEMO_MODE=false

# Optional: LLM Keys (for real AI analysis)
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
```

⚠️ **Security Note**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. NEVER commit this to git or expose it in client code. It's server-only.

### Step 5: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy contents of `supabase/schema.sql` and paste
4. Click **"Run"** (or press Cmd/Ctrl + Enter)
5. You should see success message ✅

### Step 6: Seed Demo Data

1. In SQL Editor, click **"New query"** again
2. Copy contents of `supabase/seed.sql` and paste
3. Click **"Run"**
4. You should see:
   ```
   status: "Seed complete!"
   creators_count: 1
   videos_count: 30
   insights_count: 15
   summaries_count: 1
   ```

### Step 7: Start Development Server

```bash
npm run dev
```

Open `http://localhost:3000` 🎉

### Step 8: Verify Data Loaded

You should see:
- Overview page with weekly summary ("Double Down" / "Stop Doing")
- 30 videos in the Videos page
- 15 videos with REPEAT/MODIFY/STOP verdicts
- 15 videos showing "Pending" status
- Patterns page with 6 winning patterns
- Recommendations page with next-post suggestion

---

## Optional: Enable AI Analysis

If you want real LLM-powered analysis instead of mocked insights:

### Anthropic Claude (Recommended)

1. Get API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

### OpenAI GPT (Alternative)

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Add to `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

The app will use Anthropic first if both are set.

**Without API keys**: Analysis still works, using heuristic-based mock insights.

---

## Testing the API Routes

### Using DevTools (Development Only)

When `NODE_ENV=development`, dev tools appear automatically at the bottom of the Overview page.

**To analyze a video:**

1. Copy a video ID from the Videos page (hover over a video card)
2. In DevTools, paste the ID
3. Enter a sample transcript:
   ```
   What if I told you productivity is a lie? Here's what actually works...
   ```
4. Click **"Run Analysis"**
5. Result appears below with verdict, reasoning, and labels
6. Refresh the page to see the video updated with the new insight

**To generate weekly summary:**

1. Click **"Generate Weekly Summary"** in DevTools
2. Result appears showing do_more and stop_doing arrays
3. Refresh to see updated Overview cards

### Using API Directly (curl/Postman)

**Run Analysis:**
```bash
curl -X POST http://localhost:3000/api/videos/video-016/run-analysis \
  -H "Content-Type: application/json" \
  -d '{"transcriptText": "Why do mornings feel impossible? I fixed it with this..."}'
```

**Generate Weekly:**
```bash
curl -X POST http://localhost:3000/api/creators/550e8400-e29b-41d4-a716-446655440000/generate-weekly
```

---

## Troubleshooting

### "Supabase environment variables not found"
- Check `.env.local` exists and has no typos
- Restart dev server after adding env vars

### "Failed to fetch dashboard data" (404)
- Creator ID doesn't exist
- Check seeded creator ID: `550e8400-e29b-41d4-a716-446655440000`

### Pages show empty state
- Ensure `DEMO_MODE=false` if using database
- Or set `DEMO_MODE=true` to use mock data

### Database connection errors
- Verify Supabase project is active (not paused)
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is the `service_role` key, not `anon`

### Videos don't have insights
- Only first 15 videos have insights after seed
- Use DevTools to analyze the remaining 15
- Or run `/api/videos/:id/run-analysis` for each

---

## Project Structure

```
growthm/
├── app/                      # Next.js 15 App Router
│   ├── (dashboard)/          # Dashboard pages
│   │   ├── overview/
│   │   ├── videos/
│   │   ├── patterns/
│   │   └── recommendations/
│   └── api/                  # API routes
├── components/               # React components
├── lib/                      # Utilities, types, clients
├── supabase/                 # SQL schema + seed
├── .env.local               # Your config (git-ignored)
├── package.json
├── README.md
└── SETUP.md                 # This file
```

---

## Next Steps

Once everything is running:

1. ✅ **Explore the UI** - Click through all 4 dashboard pages
2. ✅ **Test DevTools** - Analyze a pending video
3. ✅ **Review patterns** - See how insights aggregate into recommendations
4. ✅ **Check mobile** - UI is responsive (tailwind breakpoints)
5. ✅ **Read API docs** - See README.md for full API reference

---

## Week 1 Scope Complete ✅

You now have:
- Premium dark dashboard UI (gold/champagne theme)
- 4 dashboard pages (Overview, Videos, Patterns, Recommendations)
- Postgres data model (Supabase)
- API routes for CRUD + analysis
- Mock data mode for instant demo
- Dev tools for testing analysis
- LLM integration (optional, mocked if missing)

**Ready for demo!** 🚀

---

Need help? Check README.md or review the code comments.
