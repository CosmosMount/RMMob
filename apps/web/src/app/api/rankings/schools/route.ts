import { err, ok, numParam } from "@/server/http";
import { listSchoolsForType } from "@/server/ladderStats";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  try {
    return ok({
      items: listSchoolsForType(
        sp.get("robot_type") || "英雄",
        sp.get("q"),
        Math.max(1, numParam(sp.get("limit"), 40))
      ),
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 400);
  }
}
