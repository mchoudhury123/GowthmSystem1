import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getQueue, QUEUE_NAMES, type IngestCreatorJob } from "@/lib/queue";

/**
 * Trigger ingestion for a creator
 * POST /api/creators/:id/ingest
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch creator
    const { data: creator, error: creatorError } = await supabaseServer
      .from("creators")
      .select("*")
      .eq("id", id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Check if already ingesting recently (within last 5 minutes)
    if (creator.last_ingested_at) {
      const lastIngest = new Date(creator.last_ingested_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastIngest.getTime()) / (1000 * 60);

      if (diffMinutes < 5) {
        return NextResponse.json(
          {
            error: "Ingestion already triggered recently. Please wait.",
            last_ingested_at: creator.last_ingested_at,
          },
          { status: 429 }
        );
      }
    }

    // Enqueue ingestion job
    const queue = getQueue();
    const jobPayload: IngestCreatorJob = {
      creatorId: creator.id,
      handle: creator.handle,
    };

    const jobId = await queue.enqueue(QUEUE_NAMES.INGEST_CREATOR, jobPayload, 3);

    console.log(`[IngestAPI] Enqueued ingestion job ${jobId} for ${creator.handle}`);

    return NextResponse.json({
      success: true,
      jobId,
      creatorId: creator.id,
      handle: creator.handle,
      message: "Ingestion job queued. Processing will begin shortly.",
    });
  } catch (error) {
    console.error("[IngestAPI] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to queue ingestion",
      },
      { status: 500 }
    );
  }
}
