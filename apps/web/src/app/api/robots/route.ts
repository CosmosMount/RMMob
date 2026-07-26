import { ok, numParam } from "@/server/http";
import { listRobotIndex } from "@/server/aggregate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return ok({
    items: listRobotIndex(Math.min(500, Math.max(1, numParam(sp.get("limit"), 100)))),
  });
}
