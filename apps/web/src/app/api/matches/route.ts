import { ok, numParam } from "@/server/http";
import { listMatches } from "@/server/matches";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const result = listMatches({
    region: sp.get("region"),
    school: sp.get("school"),
    limit: Math.min(200, Math.max(1, numParam(sp.get("limit"), 40))),
    offset: Math.max(0, numParam(sp.get("offset"), 0)),
  });
  return ok(result);
}
