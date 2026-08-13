import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/rpc-pnl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public leaderboard — no access key required (usernames/avatars only). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit") || 50)));
  const result = await getLeaderboard(limit);
  return NextResponse.json(
    {
      ok: true,
      source: result.source,
      note: result.note,
      leaders: result.rows,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
