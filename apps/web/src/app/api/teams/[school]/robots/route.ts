import { err, ok } from "@/server/http";
import { getTeamRobotRoster } from "@/server/ladderStats";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ school: string }> }
) {
  const { school } = await ctx.params;
  try {
    return ok(getTeamRobotRoster(decodeURIComponent(school)));
  } catch (e) {
    return err(String(e), 500);
  }
}
