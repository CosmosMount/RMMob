import { ok, numParam } from "@/server/http";
import { listEvents } from "@/server/rounds";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const collapse = sp.get("collapse_shots");
  return ok(
    listEvents(gameId, {
      team: sp.get("team"),
      robot_type: sp.get("robot_type"),
      collapse_shots: collapse == null ? true : collapse !== "false",
      limit: Math.min(5000, Math.max(1, numParam(sp.get("limit"), 500))),
    })
  );
}
