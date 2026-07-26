import { ok } from "@/server/http";
import { analyticsOverview } from "@/server/aggregate";

export const runtime = "nodejs";

export async function GET() {
  return ok(analyticsOverview());
}
