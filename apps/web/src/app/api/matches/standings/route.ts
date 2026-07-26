import { ok, numParam } from "@/server/http";
import { schoolStandings } from "@/server/matches";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return ok({
    items: schoolStandings(Math.min(50, Math.max(1, numParam(sp.get("limit"), 15)))),
  });
}
