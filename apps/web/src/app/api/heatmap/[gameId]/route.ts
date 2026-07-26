import { ok, numParam } from "@/server/http";
import { getHeatmap } from "@/server/viz";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start");
  const end = sp.get("end");
  return ok(
    getHeatmap(gameId, {
      metric: sp.get("metric") || "movement",
      team: sp.get("team"),
      robot_type: sp.get("robot_type"),
      robot_id: sp.get("robot_id"),
      start: start == null ? null : numParam(start, 0),
      end: end == null ? null : numParam(end, 0),
    })
  );
}
