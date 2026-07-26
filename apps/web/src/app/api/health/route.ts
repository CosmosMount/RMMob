import { sqliteExists, sqlitePath } from "@/server/db";
import { ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  return ok({
    status: "ok",
    backend: "sqlite",
    sqlite_path: sqlitePath(),
    sqlite_exists: sqliteExists(),
  });
}
