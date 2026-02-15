# Growthm Week 2 - Production Runbook

## Overview

Week 2 transforms Growthm from a demo app into a **real, working production system** with:
- ✅ Real TikTok data ingestion via Apify
- ✅ Automatic video processing pipeline (download → transcribe → analyze)
- ✅ Background job queue with retries (Upstash Redis)
- ✅ OpenAI Whisper transcription
- ✅ Kimi (Moonshot) AI insights with strict validation
- ✅ Live UI with polling and status updates
- ✅ No mock data - Supabase DB is the source of truth

---

## Prerequisites

### Required Services
1. **Supabase** - Postgres database
2. **Apify** - TikTok scraping
3. **OpenAI** - Whisper transcription
4. **Kimi (Moonshot)** - AI insights generation
5. **Upstash Redis** - Job queue (REST API)

### Environment Variables

All these are already in your `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Apify
APIFY_API_TOKEN=your-apify-api-token

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Kimi (Moonshot)
KIMI_API_KEY=your-kimi-api-key

# Upstash Redis
UPSTASH_REDIS_REST_URL="your-upstash-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-token"

# Worker Security
WORKER_SECRET=your-secret-token-here  # Add this!

# Optional: App URL for dispatcher
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**⚠️ SECURITY**: Never commit `.env.local` to git. All API keys must be server-side only.

---

## Setup Steps

### 1. Run Database Migration

In Supabase SQL Editor:

```bash
# Run migration
supabase/migration_week2.sql
```

This adds:
- New columns to `videos` (processing_status, transcript, etc.)
- New `job_runs` table
- Updated `get_creator_dashboard()` function

Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'videos' AND column_name = 'processing_status';
```

### 2. Install Dependencies

```bash
npm install zod
```

### 3. Add WORKER_SECRET

Add to `.env.local`:
```bash
WORKER_SECRET=growthm-worker-secret-$(openssl rand -hex 16)
```

This secures worker endpoints from unauthorized access.

### 4. Start Development Server

```bash
npm run dev
```

---

## Architecture

### Data Flow

```
User clicks "Ingest Latest Videos"
  ↓
POST /api/creators/:id/ingest
  ↓
Enqueue job → Upstash Redis (ingest_creator)
  ↓
Dispatcher pulls job → Calls /api/worker/ingest-creator
  ↓
Apify scrapes TikTok → Upserts videos to DB
  ↓
For each video: Enqueue process_video job
  ↓
Dispatcher pulls jobs → Calls /api/worker/process-video
  ↓
Download video → Extract audio → Transcribe → Generate insights
  ↓
Save to DB → Update processing_status = DONE
  ↓
UI polls every 5s → Shows live progress
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `lib/queue.ts` | Upstash Redis queue abstraction |
| `lib/apify.ts` | TikTok profile scraping |
| `lib/transcription.ts` | OpenAI Whisper integration |
| `lib/insights.ts` | Kimi AI + Zod validation |
| `lib/videoProcessing.ts` | Video download + audio extraction |
| `app/api/worker/*` | Background job workers |
| `app/api/jobs/dispatch` | Job dispatcher (pulls from queue) |

---

## Usage

### Triggering Ingestion (UI)

1. Open dashboard: `http://localhost:3000`
2. Click "🔄 Ingest Latest Videos" button
3. Wait for processing banner to appear
4. UI auto-polls every 5 seconds
5. Watch videos progress through statuses:
   - PENDING → DOWNLOADING → TRANSCRIBING → ANALYZING → DONE

### Triggering Ingestion (API)

```bash
curl -X POST http://localhost:3000/api/creators/550e8400-e29b-41d4-a716-446655440000/ingest
```

Response:
```json
{
  "success": true,
  "jobId": "ingest_creator-1234567890-abc123",
  "message": "Ingestion job queued..."
}
```

### Running the Dispatcher (Manual)

The dispatcher pulls jobs from Redis and processes them:

```bash
curl -X POST http://localhost:3000/api/jobs/dispatch
```

Response:
```json
{
  "success": true,
  "processed": 3,
  "results": [...],
  "stats": {
    "ingest_creator": { "queued": 0, "processing": 0 },
    "process_video": { "queued": 5, "processing": 3 }
  }
}
```

**⚠️ For production**: Set up a cron job to call this endpoint every 1-2 minutes.

Example cron (Linux):
```bash
* * * * * curl -X POST http://your-domain.com/api/jobs/dispatch
```

Or use Vercel Cron:
```json
// vercel.json
{
  "crons": [{
    "path": "/api/jobs/dispatch",
    "schedule": "*/1 * * * *"
  }]
}
```

---

## Processing Pipeline Details

### Step 1: Ingest Creator

**Worker**: `/api/worker/ingest-creator`

1. Call Apify API with creator handle
2. Wait for scrape to complete (polls status)
3. Fetch ~30 latest videos
4. Normalize data:
   - Extract tiktok_id, caption, views, likes
   - Set processing_status = PENDING
5. Upsert to `videos` table (by tiktok_id)
6. Enqueue `process_video` for each new video
7. Update creator.last_ingested_at

**Typical duration**: 30-60 seconds

**Failure modes**:
- Apify API down → Retry (3 attempts)
- Invalid handle → Mark job as FAILED
- No videos found → Warning, don't retry

### Step 2: Process Video

**Worker**: `/api/worker/process-video`

1. **Download** (processing_status = DOWNLOADING)
   - Fetch video from source_url
   - Save to `/tmp/growthm/{videoId}/video.mp4`

2. **Extract Audio**
   - Try ffmpeg (if available)
   - Fallback: use video file directly (Whisper accepts mp4)
   - Save to `/tmp/growthm/{videoId}/audio.mp3`

3. **Transcribe** (processing_status = TRANSCRIBING)
   - Call OpenAI Whisper API
   - Upload audio file
   - Get transcript text
   - Save to videos.transcript

4. **Analyze** (processing_status = ANALYZING)
   - Call Kimi API with transcript + video metadata
   - Parse JSON response
   - Validate with Zod schema
   - If invalid → Retry once with repair prompt
   - Save to video_insights table

5. **Complete**
   - Set processing_status = DONE
   - Cleanup temp files

**Typical duration**: 60-120 seconds per video

**Failure modes**:
- Download fails → Retry (3 attempts)
- Whisper fails → Retry
- Kimi returns invalid JSON → Repair attempt, then fail
- FFmpeg not available → Use fallback (video file as audio)

---

## Monitoring

### Queue Status

Check queue lengths:

```bash
curl http://localhost:3000/api/jobs/dispatch | jq '.stats'
```

Output:
```json
{
  "ingest_creator": { "queued": 0, "processing": 0 },
  "process_video": { "queued": 12, "processing": 5 }
}
```

### Database Status

```sql
-- Check processing status breakdown
SELECT processing_status, COUNT(*)
FROM videos
GROUP BY processing_status;

-- Check recent job runs
SELECT job_type, status, COUNT(*)
FROM job_runs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY job_type, status;

-- Find failed videos
SELECT id, caption, processing_error
FROM videos
WHERE processing_status = 'FAILED'
ORDER BY created_at DESC
LIMIT 10;
```

### Logs

All workers log to console:

```bash
# Dev server logs show:
[Apify] Starting scrape for @username
[Worker:IngestCreator] Found 28 videos
[Worker:ProcessVideo] Starting processing for video abc123
[Whisper] Transcription complete: 245 characters
[Kimi] Generating insights...
```

---

## Troubleshooting

### Issue: "APIFY_API_TOKEN is not configured"

**Solution**: Check `.env.local` has valid Apify token.

Test Apify:
```bash
curl "https://api.apify.com/v2/acts?token=YOUR_TOKEN"
```

### Issue: "FFmpeg not available"

**Solution**: Install ffmpeg or use fallback.

Install (macOS):
```bash
brew install ffmpeg
```

Install (Linux):
```bash
sudo apt-get install ffmpeg
```

**Or** use fallback: The system will automatically use the video file directly with Whisper.

### Issue: "Kimi API error: 401"

**Solution**: Check KIMI_API_KEY is valid.

Test Kimi:
```bash
curl https://api.moonshot.cn/v1/models \
  -H "Authorization: Bearer YOUR_KEY"
```

### Issue: Jobs stuck in "QUEUED"

**Solution**: Dispatcher not running.

Manually trigger:
```bash
curl -X POST http://localhost:3000/api/jobs/dispatch
```

Or set up cron (see above).

### Issue: "Validation error" from Kimi

**Cause**: Kimi returned JSON that doesn't match strict schema.

**Solution**: Check lib/insights.ts validation logic. The system retries once with a repair prompt.

View raw response in logs:
```
[Kimi] Validation error: verdict: Invalid enum value
```

### Issue: Videos stay in "DOWNLOADING" forever

**Cause**: source_url is invalid or video deleted.

**Solution**: Check videos table:
```sql
SELECT id, source_url, processing_error
FROM videos
WHERE processing_status = 'DOWNLOADING'
AND updated_at < NOW() - INTERVAL '10 minutes';
```

Manually mark as failed:
```sql
UPDATE videos
SET processing_status = 'FAILED',
    processing_error = 'Download timeout'
WHERE processing_status = 'DOWNLOADING'
AND updated_at < NOW() - INTERVAL '10 minutes';
```

---

## Performance Tips

### 1. Parallel Processing

The dispatcher processes up to 5 video jobs in parallel:

```typescript
// In /api/jobs/dispatch
for (let i = 0; i < 5; i++) {
  const job = await queue.dequeue(QUEUE_NAMES.PROCESS_VIDEO, 1);
  // ...
}
```

Increase this for faster processing (if you have API rate limits).

### 2. Batch Ingestion

Ingest multiple creators:

```bash
for creator_id in creator1 creator2 creator3; do
  curl -X POST http://localhost:3000/api/creators/$creator_id/ingest
done
```

### 3. Cleanup Old Videos

Archive or delete videos older than 90 days:

```sql
DELETE FROM videos
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Common Workflows

### First-Time Setup

1. Run migration: `supabase/migration_week2.sql`
2. Create creator:
   ```bash
   curl -X POST http://localhost:3000/api/creators \
     -H "Content-Type: application/json" \
     -d '{"handle": "@yourhandle", "niche": "productivity"}'
   ```
3. Note creator_id from response
4. Update `CREATOR_ID` in `app/(dashboard)/overview/page.tsx`
5. Trigger ingestion (UI or API)
6. Run dispatcher: `curl -X POST http://localhost:3000/api/jobs/dispatch`
7. Wait for processing
8. Generate weekly summary:
   ```bash
   curl -X POST http://localhost:3000/api/creators/YOUR_ID/generate-weekly
   ```

### Daily Operations

1. User clicks "Ingest Latest Videos" in UI
2. System auto-processes
3. Check status in UI (auto-polling)
4. Generate weekly summary as needed

### Testing a Single Video

Use DevTools component (bottom of Overview page):

1. Find a video ID with PENDING status
2. Enter video ID
3. Paste sample transcript
4. Click "Run Analysis"
5. View result JSON

---

## API Reference

### POST /api/creators/:id/ingest

Trigger ingestion for a creator.

**Auth**: None (add auth in production)

**Request**: None

**Response**:
```json
{
  "success": true,
  "jobId": "ingest_creator-...",
  "creatorId": "...",
  "handle": "@username",
  "message": "Ingestion job queued..."
}
```

**Errors**:
- 404: Creator not found
- 429: Recently ingested (wait 5 minutes)
- 500: Queue error

### POST /api/jobs/dispatch

Run job dispatcher (pull from queue and process).

**Auth**: Optional `Authorization: Bearer WORKER_SECRET`

**Request**: None

**Response**:
```json
{
  "success": true,
  "processed": 3,
  "results": [
    { "job": "...", "status": "completed" },
    { "job": "...", "status": "failed", "error": "..." }
  ],
  "stats": { ... }
}
```

### POST /api/worker/ingest-creator

Background worker for creator ingestion.

**Auth**: `Authorization: Bearer WORKER_SECRET` (required)

**Request**:
```json
{
  "creatorId": "...",
  "handle": "@username"
}
```

**Response**:
```json
{
  "success": true,
  "videosFound": 28,
  "videosUpserted": 15,
  "jobsEnqueued": 15
}
```

### POST /api/worker/process-video

Background worker for video processing.

**Auth**: `Authorization: Bearer WORKER_SECRET` (required)

**Request**:
```json
{
  "videoId": "..."
}
```

**Response**:
```json
{
  "success": true,
  "videoId": "...",
  "verdict": "REPEAT",
  "transcriptLength": 245
}
```

---

## Production Deployment

### Vercel

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy
5. Set up Vercel Cron for dispatcher
6. Add domain

### Environment Variables (Vercel)

Go to Project Settings → Environment Variables:

- All `NEXT_PUBLIC_*` vars
- `SUPABASE_SERVICE_ROLE_KEY`
- `APIFY_API_TOKEN`
- `OPENAI_API_KEY`
- `KIMI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `WORKER_SECRET`

### Cron Setup (Vercel)

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/jobs/dispatch",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

This runs dispatcher every 2 minutes.

---

## Cost Estimates (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Supabase | 1 DB, 5GB storage | $0 (free tier) |
| Apify | ~30 runs/mo | $5-10 |
| OpenAI Whisper | ~100 videos @ 20s avg | $12 |
| Kimi API | ~100 requests | $2-5 |
| Upstash Redis | Queue ops | $0 (free tier) |
| Vercel | Hosting | $0 (free tier) |
| **Total** | | **~$20-30/mo** |

Scale: For 1000 videos/mo, expect ~$150-200.

---

## Next Steps (Week 3+)

- [ ] Add user authentication (Supabase Auth)
- [ ] Multi-creator support per user
- [ ] Scheduled auto-ingestion (daily)
- [ ] Email notifications (insights ready)
- [ ] Export reports (PDF/CSV)
- [ ] Pattern trend tracking
- [ ] Recommendation algorithm v2
- [ ] Mobile app (React Native)

---

**Questions?** Check code comments or README.md.

**Week 2 Complete!** 🎉 You now have a fully functional TikTok intelligence platform.
