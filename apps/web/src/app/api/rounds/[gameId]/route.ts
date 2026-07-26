import { err, ok, numParam } from "@/server/http";
import { getRoundDetail } from "@/server/rounds";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const at = sp.get("at_second");
  const detail = getRoundDetail(
    gameId,
    at == null ? null : numParam(at, 0)
  );
  if (!detail) return err("round not found", 404);
  return ok(detail);
}
