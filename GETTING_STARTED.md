# Getting Started with Growthm Week 2

## ✅ Quick Start Checklist

### 1. Run Database Migration

Open Supabase SQL Editor and run:

```sql
-- File: supabase/migration_week2.sql
-- This adds processing_status, transcript, job_runs table, etc.
```

**Verify migration worked:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'videos' AND column_name IN ('processing_status', 'transcript');
```

Should return 2 rows.

---

### 2. Start Development Server

```bash
npm run dev
```

Server starts on `http://localhost:3000` (or next available port).

---

### 3. Open Dashboard

Visit: `http://localhost:3000`

You should see:
- Overview page
- "🔄 Ingest Latest Videos" button
- Empty state (no videos yet)

---

### 4. Trigger Ingestion

Click the "🔄 Ingest Latest Videos" button.

This will:
1. Enqueue an `ingest_creator` job in Redis
2. Show "Starting..." button state
3. Return immediately

---

### 5. Run Job Dispatcher

**Open a new terminal** and run:

```bash
curl -X POST http://localhost:3000/api/jobs/dispatch
```

Or use this command to auto-dispatch every 30 seconds:

```bash
while true; do
  curl -s -X POST http://localhost:3000/api/jobs/dispatch | jq '.stats'
  sleep 30
done
```

(Requires `jq` installed: `brew install jq` on macOS)

---

### 6. Watch Processing

Back in the browser, you should see:

1. **Processing banner appears**:
   ```
   ⚙️ Processing videos...
   15 pending · 0 downloading · 0 transcribing · 0 analyzing
   ```

2. **Videos appear in the list** with status badges:
   - PENDING (gray)
   - DOWNLOADING (gray)
   - TRANSCRIBING (gray)
   - ANALYZING (gray)
   - DONE (green/amber/red depending on verdict)
   - FAILED (red)

3. **UI auto-polls every 5 seconds** while processing

4. **Banner disappears** when all videos are DONE or FAILED

---

### 7. Generate Weekly Summary

Once videos are analyzed:

```bash
curl -X POST http://localhost:3000/api/creators/550e8400-e29b-41d4-a716-446655440000/generate-weekly
```

Or use the DevTools component at the bottom of the Overview page.

Refresh the page to see:
- "What to Double Down On This Week" card
- "Stop Doing" card

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch dashboard"

**Cause**: Database not migrated or creator doesn't exist.

**Solution**:
1. Run migration: `supabase/migration_week2.sql`
2. Check creator exists:
   ```sql
   SELECT * FROM creators WHERE id = '550e8400-e29b-41d4-a716-446655440000';
   ```

If not exists, run seed: `supabase/seed.sql`

---

### Issue: Videos stay in PENDING forever

**Cause**: Dispatcher not running.

**Solution**: Run dispatcher manually:
```bash
curl -X POST http://localhost:3000/api/jobs/dispatch
```

Or set up auto-dispatch loop (see step 5).

---

### Issue: "Apify API error"

**Cause**: Invalid APIFY_API_TOKEN or rate limit.

**Solution**:
1. Check `.env.local` has valid token
2. Test Apify:
   ```bash
   curl "https://api.apify.com/v2/acts?token=YOUR_TOKEN"
   ```
3. Check Apify dashboard for usage/limits

---

### Issue: "Whisper API error: 401"

**Cause**: Invalid OPENAI_API_KEY.

**Solution**:
1. Check `.env.local` has valid key
2. Test OpenAI:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```

---

### Issue: "Kimi API error"

**Cause**: Invalid KIMI_API_KEY.

**Solution**:
1. Check `.env.local` has valid key
2. Test Kimi:
   ```bash
   curl https://api.moonshot.cn/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```

---

### Issue: "FFmpeg not available"

**Solution**: Install ffmpeg or use fallback (automatic).

**macOS**:
```bash
brew install ffmpeg
```

**Linux**:
```bash
sudo apt-get install ffmpeg
```

**Windows**:
Download from https://ffmpeg.org/download.html

**Or**: System will automatically use video file directly (Whisper accepts mp4).

---

### Issue: No processing happening

**Debug checklist**:

1. Check queue has jobs:
   ```bash
   curl http://localhost:3000/api/jobs/dispatch | jq '.stats'
   ```

2. Check job_runs table:
   ```sql
   SELECT job_type, status, error_message
   FROM job_runs
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. Check videos table:
   ```sql
   SELECT processing_status, COUNT(*)
   FROM videos
   GROUP BY processing_status;
   ```

4. Check server logs for errors

---

## 📖 Full Documentation

- **WEEK2_RUNBOOK.md** - Complete operational guide
- **WEEK2_SUMMARY.md** - Implementation overview
- **README.md** - Week 1 documentation

---

## 🎯 What to Expect

### First Ingestion (30 videos)

**Timeline**:
1. Trigger ingestion: Instant
2. Apify scrape: 30-60 seconds
3. Videos appear in DB: Instant
4. Process each video: 20-45 seconds
5. **Total**: 3-5 minutes for 30 videos

**What happens**:
- Videos progress through: PENDING → DOWNLOADING → TRANSCRIBING → ANALYZING → DONE
- UI updates every 5 seconds
- Processing stats show live counts
- Verdict badges appear (REPEAT/MODIFY/STOP)

---

## 🚀 Production Deployment

### Vercel

1. Push code to GitHub
2. Import to Vercel
3. Add all environment variables
4. Deploy
5. Set up Vercel Cron:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/jobs/dispatch",
    "schedule": "*/2 * * * *"
  }]
}
```

This runs dispatcher every 2 minutes automatically.

---

## 💡 Tips

### Faster Processing

Increase parallel workers in `/api/jobs/dispatch/route.ts`:

```typescript
// Process up to 10 videos in parallel instead of 5
for (let i = 0; i < 10; i++) {
  const job = await queue.dequeue(QUEUE_NAMES.PROCESS_VIDEO, 1);
  // ...
}
```

### Manual Testing

Use DevTools at bottom of Overview page:

1. Find video ID with PENDING status
2. Enter any transcript text
3. Click "Run Analysis"
4. View result JSON

This bypasses the queue for quick testing.

### Monitor Queue

```bash
# Check queue status
curl http://localhost:3000/api/jobs/dispatch | jq '.'

# Output:
{
  "processed": 3,
  "stats": {
    "ingest_creator": { "queued": 0, "processing": 0 },
    "process_video": { "queued": 12, "processing": 5 }
  }
}
```

---

## ✅ Success Criteria

After setup, you should be able to:

- [x] Click "Ingest Latest Videos" button
- [x] See processing banner appear
- [x] Watch videos progress through statuses
- [x] See verdicts (REPEAT/MODIFY/STOP) appear
- [x] Generate weekly summary
- [x] See "Double Down" and "Stop Doing" cards
- [x] Use DevTools to analyze individual videos

---

## 🎉 You're Ready!

Your Growthm Week 2 system is now fully operational.

**Next steps**:
1. Test with a real TikTok handle
2. Set up auto-dispatch (cron or loop)
3. Deploy to production
4. Start analyzing content!

Questions? Check **WEEK2_RUNBOOK.md** for detailed documentation.
