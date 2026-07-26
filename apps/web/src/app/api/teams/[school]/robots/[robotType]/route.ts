import { err, ok } from "@/server/http";
import { getTeamRobotDetail } from "@/server/ladderStats";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ school: string; robotType: string }> }
) {
  const { school, robotType } = await ctx.params;
  try {
    const result = getTeamRobotDetail(
      decodeURIComponent(school),
      decodeURIComponent(robotType)
    );
    if (!result) return err("robot not found", 404);
    return ok(result);
  } catch (e) {
    return err(String(e), 400);
  }
}
