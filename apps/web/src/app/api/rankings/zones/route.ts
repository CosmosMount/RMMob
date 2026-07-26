import { err, ok } from "@/server/http";
import { listZones } from "@/server/ladderStats";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok({ items: listZones() });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 503);
  }
}
