import { ok } from "@/server/http";
import { listRegions } from "@/server/matches";

export const runtime = "nodejs";

export async function GET() {
  return ok({ items: listRegions() });
}
