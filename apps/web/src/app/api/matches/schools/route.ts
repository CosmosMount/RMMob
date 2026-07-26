import { ok, numParam } from "@/server/http";
import { listSchools } from "@/server/matches";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, numParam(sp.get("limit"), 40)));
  const offset = Math.max(0, numParam(sp.get("offset"), 0));
  return ok(listSchools(sp.get("q"), limit, offset));
}
