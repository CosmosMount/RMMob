import { err, ok } from "@/server/http";
import { getMatchGroup } from "@/server/matches";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ matchKey: string }> }
) {
  const { matchKey } = await ctx.params;
  const group = getMatchGroup(decodeURIComponent(matchKey));
  if (!group) return err("not_found", 404);
  return ok(group);
}
