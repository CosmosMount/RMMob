import { err, ok, numParam } from "@/server/http";
import { getTrajectory } from "@/server/viz";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ gameId: string; robotId: string }> }
) {
  const { gameId, robotId } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start");
  const end = sp.get("end");
  const result = getTrajectory(gameId, decodeURIComponent(robotId), {
    start: start == null ? null : numParam(start, 0),
    end: end == null ? null : numParam(end, 0),
  });
  if (!result) return err("trajectory not found", 404);
  return ok(result);
}
