import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: assets, error } = await supabaseServer
      .from("video_assets")
      .select("public_url, meta")
      .eq("video_id", id)
      .eq("asset_type", "FRAME")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      frames: (assets || []).map((a: any) => a.public_url).filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch video assets" },
      { status: 500 }
    );
  }
}
