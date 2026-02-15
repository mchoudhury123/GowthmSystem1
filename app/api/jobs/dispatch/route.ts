import { NextRequest, NextResponse } from "next/server";
import { getQueue, QUEUE_NAMES } from "@/lib/queue";

const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-change-in-production";
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Job Dispatcher
 * Pulls jobs from Redis queues and calls worker endpoints
 * Can be triggered manually or via cron
 */
export async function POST(request: NextRequest) {
  // Optional: Add auth for dispatcher
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = getQueue();
  const results: any[] = [];

  try {
    // Process ingest_creator jobs
    const ingestJob = await queue.dequeue(QUEUE_NAMES.INGEST_CREATOR, 1);
    if (ingestJob) {
      console.log(`[Dispatcher] Processing ingest_creator job: ${ingestJob.id}`);

      try {
        const response = await fetch(`${API_URL}/api/worker/ingest-creator`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WORKER_SECRET}`,
          },
          body: JSON.stringify(ingestJob.payload),
        });

        if (response.ok) {
          await queue.complete(QUEUE_NAMES.INGEST_CREATOR, ingestJob.id);
          results.push({ job: ingestJob.id, status: "completed" });
        } else {
          const error = await response.text();
          await queue.fail(QUEUE_NAMES.INGEST_CREATOR, ingestJob, error);
          results.push({ job: ingestJob.id, status: "failed", error });
        }
      } catch (error) {
        await queue.fail(
          QUEUE_NAMES.INGEST_CREATOR,
          ingestJob,
          error instanceof Error ? error.message : "Worker request failed"
        );
        results.push({
          job: ingestJob.id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Process up to 5 process_video jobs in parallel
    const videoJobs = [];
    for (let i = 0; i < 5; i++) {
      const job = await queue.dequeue(QUEUE_NAMES.PROCESS_VIDEO, 1);
      if (job) {
        videoJobs.push(job);
      }
    }

    if (videoJobs.length > 0) {
      console.log(`[Dispatcher] Processing ${videoJobs.length} process_video jobs`);

      await Promise.all(
        videoJobs.map(async (job) => {
          try {
            const response = await fetch(`${API_URL}/api/worker/process-video`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${WORKER_SECRET}`,
              },
              body: JSON.stringify(job.payload),
            });

            if (response.ok) {
              await queue.complete(QUEUE_NAMES.PROCESS_VIDEO, job.id);
              results.push({ job: job.id, status: "completed" });
            } else {
              const error = await response.text();
              await queue.fail(QUEUE_NAMES.PROCESS_VIDEO, job, error);
              results.push({ job: job.id, status: "failed", error });
            }
          } catch (error) {
            await queue.fail(
              QUEUE_NAMES.PROCESS_VIDEO,
              job,
              error instanceof Error ? error.message : "Worker request failed"
            );
            results.push({
              job: job.id,
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })
      );
    }

    // Get queue stats
    const stats = {
      ingest_creator: {
        queued: await queue.getQueueLength(QUEUE_NAMES.INGEST_CREATOR),
        processing: await queue.getProcessingLength(QUEUE_NAMES.INGEST_CREATOR),
      },
      process_video: {
        queued: await queue.getQueueLength(QUEUE_NAMES.PROCESS_VIDEO),
        processing: await queue.getProcessingLength(QUEUE_NAMES.PROCESS_VIDEO),
      },
    };

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      stats,
    });
  } catch (error) {
    console.error("[Dispatcher] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Dispatch failed",
      },
      { status: 500 }
    );
  }
}
