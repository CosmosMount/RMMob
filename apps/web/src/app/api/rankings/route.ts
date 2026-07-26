import { err, ok, numParam } from "@/server/http";
import { getRankings } from "@/server/ladderStats";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  try {
    return ok(
      getRankings(sp.get("robot_type") || "英雄", {
        region: sp.get("region"),
        zoneId: sp.get("zone_id"),
        sortBy: sp.get("sort_by"),
        limit: Math.min(300, Math.max(1, numParam(sp.get("limit"), 60))),
      })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("Missing")) return err(msg, 503);
    return err(msg, 400);
  }
}
