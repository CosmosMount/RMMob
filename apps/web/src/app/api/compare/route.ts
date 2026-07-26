import { err, ok } from "@/server/http";
import { getCompare } from "@/server/ladderStats";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const schools = (sp.get("schools") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    return ok(getCompare(sp.get("robot_type") || "英雄", schools));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("Missing")) return err(msg, 503);
    return err(msg, 400);
  }
}
