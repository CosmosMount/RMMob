/**
 * Static GitHub Pages build:
 * Hide App Router API + dynamic [param] routes (incompatible / unused on Pages),
 * build with STATIC_EXPORT=1, then restore.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const backupRoot = path.join(root, ".pages-build-backup");

const HIDE = [
  "src/app/api",
  "src/app/matches/[matchKey]",
  "src/app/teams/[school]",
];

function hidePaths() {
  if (fs.existsSync(backupRoot)) fs.rmSync(backupRoot, { recursive: true, force: true });
  fs.mkdirSync(backupRoot, { recursive: true });
  const moved = [];
  for (const rel of HIDE) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) {
      console.warn(`[build-pages] skip missing ${rel}`);
      continue;
    }
    const to = path.join(backupRoot, rel.replace(/[\\/]/g, "__"));
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
    moved.push({ from, to, rel });
    console.log(`[build-pages] hid ${rel}`);
  }
  return moved;
}

function restorePaths(moved) {
  for (const { from, to, rel } of moved) {
    if (!fs.existsSync(to)) {
      console.warn(`[build-pages] backup missing for ${rel}`);
      continue;
    }
    fs.mkdirSync(path.dirname(from), { recursive: true });
    if (fs.existsSync(from)) fs.rmSync(from, { recursive: true, force: true });
    fs.cpSync(to, from, { recursive: true });
    console.log(`[build-pages] restored ${rel}`);
  }
  if (fs.existsSync(backupRoot)) fs.rmSync(backupRoot, { recursive: true, force: true });
}

const stale = path.join(root, "src", "app", ".api-hidden-for-pages");
if (fs.existsSync(stale)) fs.rmSync(stale, { recursive: true, force: true });
const staleApi = path.join(root, ".pages-api-backup");
if (fs.existsSync(staleApi)) {
  // recover if previous run left api only in backup
  const apiDir = path.join(root, "src", "app", "api");
  if (!fs.existsSync(apiDir)) {
    fs.cpSync(staleApi, apiDir, { recursive: true });
    console.log("[build-pages] recovered api from .pages-api-backup");
  }
  fs.rmSync(staleApi, { recursive: true, force: true });
}

let moved = [];
let exitCode = 0;
try {
  moved = hidePaths();
  const env = {
    ...process.env,
    STATIC_EXPORT: "1",
    NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "",
    BASE_PATH: process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "",
  };
  const r = spawnSync("npx", ["next", "build"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: true,
  });
  exitCode = r.status ?? 1;
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  restorePaths(moved);
}

process.exit(exitCode);
