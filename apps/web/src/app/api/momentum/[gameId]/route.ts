import { ok } from "@/server/http";
import { computeMomentum } from "@/server/momentum";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await ctx.params;
  return ok(computeMomentum(gameId));
}
