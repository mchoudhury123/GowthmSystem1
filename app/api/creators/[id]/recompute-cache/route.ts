import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { computeDashboardCache } from "@/lib/computeDashboard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify creator exists
    const { data: creator, error } = await supabaseServer
      .from("creators")
      .select("id")
      .eq("id", id)
      .single();

    if (error || !creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    console.log(`[RecomputeCache] Computing dashboard cache for creator ${id}`);

    const cache = await computeDashboardCache(id);

    // Upsert into creator_cached_dashboard
    const { error: upsertError } = await supabaseServer
      .from("creator_cached_dashboard")
      .upsert(
        {
          creator_id: id,
          cache_json: cache,
          computed_at: cache.computedAt,
        },
        { onConflict: "creator_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log(`[RecomputeCache] Cache computed and stored for creator ${id}`);

    return NextResponse.json({ success: true, cache });
  } catch (error) {
    console.error("[RecomputeCache] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recompute cache" },
      { status: 500 }
    );
  }
}
