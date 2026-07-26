import { err, ok } from "@/server/http";
import { getTeam } from "@/server/aggregate";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ school: string }> }
) {
  const { school } = await ctx.params;
  const result = getTeam(decodeURIComponent(school));
  if (!result) return err("team not found", 404);
  return ok(result);
}
