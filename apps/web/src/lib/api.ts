const BASE = typeof window === "undefined" ? absoluteApiBase() : "/api";

function absoluteApiBase(): string {
  if (process.env.API_INTERNAL_URL) return process.env.API_INTERNAL_URL;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}/api`;
}

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<{ status: string; backend: string }>("/health"),
  matches: (q: { region?: string; school?: string; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    if (q.region) sp.set("region", q.region);
    if (q.school) sp.set("school", q.school);
    if (q.limit) sp.set("limit", String(q.limit));
    const qs = sp.toString();
    return get<{ total: number; items: import("./types").MatchGroup[] }>(
      `/matches${qs ? `?${qs}` : ""}`
    );
  },
  regions: () => get<{ items: string[] }>("/matches/regions"),
  schools: (q?: string) =>
    get<{ items: string[] }>(`/matches/schools${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  standings: (limit = 12) =>
    get<{
      items: Array<{
        rank: number;
        school: string;
        region: string;
        played: number;
        won: number;
        lost: number;
        drawn: number;
        pts: number;
      }>;
    }>(`/matches/standings?limit=${limit}`),
  match: (matchKey: string) =>
    get<import("./types").MatchGroup>(`/matches/${encodeURIComponent(matchKey)}`),
  round: (gameId: string, atSecond?: number) =>
    get<import("./types").RoundDetail>(
      `/rounds/${gameId}${atSecond != null ? `?at_second=${atSecond}` : ""}`
    ),
  statistics: (gameId: string) =>
    get<{ bars: import("./types").StatBar[] }>(`/rounds/${gameId}/statistics`),
  events: (gameId: string, q: { team?: string; robot_type?: string } = {}) => {
    const sp = new URLSearchParams();
    if (q.team) sp.set("team", q.team);
    if (q.robot_type) sp.set("robot_type", q.robot_type);
    const qs = sp.toString();
    return get<{ items: import("./types").EventItem[] }>(
      `/events/${gameId}${qs ? `?${qs}` : ""}`
    );
  },
  momentum: (gameId: string) =>
    get<import("./types").MomentumResponse>(`/momentum/${gameId}`),
  heatmap: (
    gameId: string,
    q: {
      metric?: string;
      team?: string;
      robot_type?: string;
      robot_id?: string;
      start?: number;
      end?: number;
    } = {}
  ) => {
    const sp = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v != null && v !== "") sp.set(k, String(v));
    });
    const qs = sp.toString();
    return get<import("./types").HeatmapResponse>(
      `/heatmap/${gameId}${qs ? `?${qs}` : ""}`
    );
  },
  trajectory: (gameId: string, robotId: string) =>
    get<import("./types").TrajectoryResponse>(
      `/trajectory/${gameId}/${encodeURIComponent(robotId)}`
    ),
  trajectoryRobots: (gameId: string) =>
    get<{ items: Array<{ robot_id: string; team: string; robot_type: string }> }>(
      `/trajectory/${gameId}/robots`
    ),
  team: (school: string) =>
    get<{
      school: string;
      matches_played: number;
      rounds_played: number;
      rounds_won: number;
      win_rate: number;
      region_counts: Record<string, number>;
      recent_matches: import("./types").MatchGroup[];
    }>(`/teams/${encodeURIComponent(school)}`),
  rankings: (robotType: string, region?: string, sortBy?: string) => {
    const sp = new URLSearchParams({ robot_type: robotType });
    if (region) sp.set("region", region);
    if (sortBy) sp.set("sort_by", sortBy);
    return get<{
      robot_type: string;
      robot_type_key: string;
      sort_by: string;
      sort_label: string;
      fields: string[];
      field_labels: Record<string, string>;
      model_version: string;
      source: string;
      items: Array<{
        rank: number;
        school: string;
        region: string | null;
        logo?: string | null;
        robot_type: string;
        kda: string;
        ladder_score: number;
        eagHurt: number | null;
        gkDamage: number | null;
        gKillCount: number | null;
        metrics: Record<string, number | string | null>;
      }>;
    }>(`/rankings?${sp}`);
  },
  rankingZones: () => get<{ items: Array<{ zoneId: string; zoneName: string }> }>("/rankings/zones"),
  rankingSchools: (robotType: string, q?: string) => {
    const sp = new URLSearchParams({ robot_type: robotType });
    if (q) sp.set("q", q);
    return get<{ items: string[] }>(`/rankings/schools?${sp}`);
  },
  compare: (robotType: string, schools: string[]) => {
    const sp = new URLSearchParams({
      robot_type: robotType,
      schools: schools.join(","),
    });
    return get<{
      robot_type: string;
      fields: string[];
      field_labels: Record<string, string>;
      teams: Array<{
        school: string;
        found: boolean;
        region?: string;
        logo?: string;
        kda?: string;
        ladder_score?: number;
        metrics: Record<string, number | string | null>;
      }>;
      series: Array<{
        field: string;
        label: string;
        values: Array<{ school: string; value: number; ratio: number }>;
      }>;
      model_version: string;
    }>(`/compare?${sp}`);
  },
  robots: () =>
    get<{
      items: Array<{
        school: string;
        robot_type: string;
        region: string;
        rounds: number;
        key: string;
      }>;
    }>("/robots"),
  analytics: () => get<{ regions: Array<{ region: string; rounds: number }>; notes: string[] }>(
    "/analytics/overview"
  ),
};
