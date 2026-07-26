/** Prefix public asset paths with Next.js `basePath` (GitHub Pages / static export). */
export function publicUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_BASE_PATH ||
    // Injected by Next when `basePath` is set in next.config
    (typeof process !== "undefined" && (process.env as Record<string, string | undefined>).__NEXT_ROUTER_BASEPATH) ||
    ""
  ).replace(/\/$/, "");
  if (!path) return base || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
