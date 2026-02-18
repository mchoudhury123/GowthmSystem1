import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getQueue, QUEUE_NAMES, type IngestCreatorJob } from "@/lib/queue";
import {
  INGEST_LOCK_TTL_SECONDS,
  MAX_VIDEOS_PER_CREATOR_PER_MONTH,
} from "@/lib/config";

/**
 * Trigger ingestion for a creator
 * POST /api/creators/:id/ingest
 *
 * Hardened:
 * - Atomic Redis lock prevents simultaneous duplicate triggers
 * - Monthly video cap enforced before enqueue
 * - last_ingested_at updated immediately (not deferred to worker)
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

    // ── Atomic lock: prevents race condition where two requests both pass the cooldown check ──
    const queue = getQueue();
    const lockKey = `lock:ingest:${id}`;
    const acquired = await queue.acquireLock(lockKey, INGEST_LOCK_TTL_SECONDS);

    if (!acquired) {
      return NextResponse.json(
        {
          error: "Ingestion already in progress or recently triggered. Please wait.",
          last_ingested_at: creator.last_ingested_at,
        },
        { status: 429 }
      );
    }

    // ── Secondary cooldown check (belt + suspenders with the lock) ──
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

    // ── Monthly usage cap ──
    const month = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseServer
      .from("creator_usage")
      .select("videos_ingested")
      .eq("creator_id", id)
      .eq("month", month)
      .single();

    if (usage && usage.videos_ingested >= MAX_VIDEOS_PER_CREATOR_PER_MONTH) {
      return NextResponse.json(
        {
          error: `Monthly limit of ${MAX_VIDEOS_PER_CREATOR_PER_MONTH} videos reached for this creator.`,
          usage: { ingested: usage.videos_ingested, limit: MAX_VIDEOS_PER_CREATOR_PER_MONTH },
        },
        { status: 429 }
      );
    }

    // ── Update last_ingested_at immediately (not deferred to worker) ──
    await supabaseServer
      .from("creators")
      .update({ last_ingested_at: new Date().toISOString() })
      .eq("id", id);

    // ── Enqueue ingestion job ──
    const jobPayload: IngestCreatorJob = {
      creatorId: creator.id,
      handle: creator.handle,
    };

    const jobId = await queue.enqueue(QUEUE_NAMES.INGEST_CREATOR, jobPayload);

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
