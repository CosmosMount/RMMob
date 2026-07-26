import { ok, numParam } from "@/server/http";
import { listSchools } from "@/server/matches";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return ok({
    items: listSchools(sp.get("q"), Math.min(200, Math.max(1, numParam(sp.get("limit"), 40)))),
  });
}
