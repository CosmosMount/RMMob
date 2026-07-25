/** Official chassis number shown in UI (蓝方 101→1 … 107→7). */
export function robotNumberLabel(robotId: string | number): string {
  const n = Number(robotId);
  if (!Number.isFinite(n)) return String(robotId);
  const chassis = n >= 100 ? n % 100 : n;
  return String(chassis);
}
