# Growthm - Quick Start

**Time to first demo: 30 seconds** ⚡

## Run the Demo

```bash
npm run dev
```

Open `http://localhost:3000`

✅ Done! Dashboard loads with mock data.

---

## What You'll See

- **Overview** → Weekly "Double Down" and "Stop Doing" cards
- **Videos** → 30 videos, 15 with REPEAT/MODIFY/STOP verdicts
- **Patterns** → 6 winning formulas identified
- **Recommendations** → Next-post suggestion with template

---

## Controls

- **Filter videos** → All / Repeat / Modify / Stop / Pending
- **Click video** → Opens detail modal with full insight
- **DevTools** (bottom of Overview) → Run analysis, generate summary

---

## File Guide

**Need to change...** | **Edit this file...**
--- | ---
UI colors/theme | `tailwind.config.ts` + `app/globals.css`
Mock data | `lib/mock/data.ts`
Database schema | `supabase/schema.sql`
API logic | `app/api/**/route.ts`
Page layout | `app/(dashboard)/*/page.tsx`

---

## Environment Variables

File: `.env.local`

```bash
DEMO_MODE=true                    # Use mock data (no database)
# DEMO_MODE=false                 # Use Supabase database

# When DEMO_MODE=false, set these:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Optional: For real AI analysis
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
```

---

## Need More?

- **Setup Guide** → `SETUP.md`
- **Full Docs** → `README.md`
- **What's Included** → `DELIVERABLES.md`

---

**Built with Claude Code** 🚀
