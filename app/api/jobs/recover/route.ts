import { NextRequest, NextResponse } from "next/server";
import { getQueue, QUEUE_NAMES } from "@/lib/queue";

const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret-change-in-production";

/**
 * POST /api/jobs/recover
 * Recovers stuck jobs from the processing list.
 * Callable from Queue page or cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queue = getQueue();
    const recoveredIngest = await queue.recoverStuckJobs(QUEUE_NAMES.INGEST_CREATOR);
    const recoveredVideo = await queue.recoverStuckJobs(QUEUE_NAMES.PROCESS_VIDEO);

    console.log(`[Recovery] Recovered ${recoveredIngest} ingest + ${recoveredVideo} video jobs`);

    return NextResponse.json({
      success: true,
      recovered: {
        ingest_creator: recoveredIngest,
        process_video: recoveredVideo,
      },
    });
  } catch (error) {
    console.error("[Recovery] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery failed" },
      { status: 500 }
    );
  }
}
