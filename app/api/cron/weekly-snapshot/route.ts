import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { computeAndStoreWeeklySnapshot } from "@/lib/computeWeeklySnapshot";

/**
 * Weekly snapshot cron job.
 * Runs every Monday at 8:00 AM UTC (configured in vercel.json).
 * Iterates all creators and computes a weekly snapshot for each.
 *
 * Secured by CRON_SECRET (Vercel automatically sends this for cron jobs).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron:WeeklySnapshot] Starting weekly snapshot computation...");

  const { data: creators, error: fetchError } = await supabaseServer
    .from("creators")
    .select("id, handle");

  if (fetchError || !creators) {
    console.error("[Cron:WeeklySnapshot] Failed to fetch creators:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch creators" },
      { status: 500 }
    );
  }

  let processed = 0;
  let failed = 0;

  for (const creator of creators) {
    try {
      await computeAndStoreWeeklySnapshot(creator.id);

      // Recompute playbook after weekly snapshot (debounced, non-fatal)
      try {
        const { computeCreatorPlaybook } = await import("@/lib/computePlaybook");
        await computeCreatorPlaybook(creator.id);
      } catch (playbookError) {
        console.warn(`[Cron:WeeklySnapshot] Playbook failed for ${creator.id} (non-fatal):`, playbookError);
      }

      processed++;
      console.log(
        `[Cron:WeeklySnapshot] Computed snapshot + playbook for @${creator.handle} (${creator.id})`
      );
    } catch (err) {
      failed++;
      console.error(
        `[Cron:WeeklySnapshot] Failed for @${creator.handle} (${creator.id}):`,
        err
      );
    }
  }

  console.log(
    `[Cron:WeeklySnapshot] Done. Processed: ${processed}, Failed: ${failed}`
  );

  return NextResponse.json({
    success: true,
    processed,
    failed,
    total: creators.length,
  });
}
