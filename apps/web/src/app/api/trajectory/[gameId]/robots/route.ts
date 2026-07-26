import { ok } from "@/server/http";
import { listRobotIds } from "@/server/viz";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  return ok({
    items: listRobotIds(gameId, {
      team: sp.get("team"),
      robot_type: sp.get("robot_type"),
    }),
  });
}
