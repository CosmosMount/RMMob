import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "services",
  "api",
  "data",
  "robot_data_2026.json"
);

const TYPE_MAP: Record<string, string> = {
  英雄: "Hero",
  工程: "Sapper",
  步兵: "Infantry",
  步兵3: "Infantry",
  步兵4: "Infantry",
  空中: "Airplane",
  哨兵: "Guard",
  雷达: "Radar",
  飞镖: "Dart",
  Hero: "Hero",
  Sapper: "Sapper",
  Infantry: "Infantry",
  Airplane: "Airplane",
  Guard: "Guard",
  Radar: "Radar",
  Dart: "Dart",
};

const TYPE_LABELS: Record<string, string> = {
  Hero: "英雄",
  Sapper: "工程",
  Infantry: "步兵",
  Airplane: "空中",
  Guard: "哨兵",
  Radar: "雷达",
  Dart: "飞镖",
};

const TYPE_FIELDS: Record<string, string[]> = {
  Infantry: [
    "eaSmallHitRate",
    "eagHurt",
    "gkDamage",
    "eaKDA",
    "gKillCount",
    "matchLargeEnergyActRoundsAvg",
  ],
  Hero: ["eaBigHitRate", "eagHurt", "gkDamage", "eaKDA", "eaSnipeCnt", "gKillCount"],
  Sapper: ["avgAssembleDiff", "eaAssembleEcon", "eaAssembleSuccCnt"],
  Airplane: ["eaSmallHitRate", "eagHurt", "gkDamage", "eaKDA", "avgShootNum", "gKillCount"],
  Guard: ["eaSmallHitRate", "eagHurt", "gkDamage", "eaKDA", "gKillCount"],
  Radar: ["eaRadarMarkerTime", "eaRadarDebuffDmg", "eaRadarParseSuccCnt", "eaRadarCounterTime"],
  Dart: [
    "etDartOutpostCnt",
    "etDartFixedCnt",
    "etDartRDFixCnt",
    "etDartRDMoveCnt",
    "etDartEndMoveCnt",
    "gkDamage",
    "gKillCount",
  ],
};

const LADDER_FIELDS: Record<string, { field: string; label: string }> = {
  Infantry: { field: "ladder_score", label: "K+0.4A" },
  Hero: { field: "gkDamage", label: "关键伤害" },
  Sapper: { field: "avgAssembleDiff", label: "兑矿等级" },
  Airplane: { field: "eagHurt", label: "造成伤害" },
  Guard: { field: "eagHurt", label: "造成伤害" },
  Radar: { field: "eaRadarMarkerTime", label: "雷达标记时长" },
  Dart: { field: "gkDamage", label: "关键伤害" },
};

/** Types where KDA / K+0.4A ladder_score is meaningful. */
const USES_KDA = new Set(["Infantry", "Hero", "Airplane", "Guard"]);

const FIELD_LABELS: Record<string, string> = {
  eaKDA: "KDA",
  ladder_score: "K+0.4A",
  eagHurt: "造成伤害",
  gkDamage: "关键伤害",
  gKillCount: "击杀",
  eaSmallHitRate: "17mm命中率",
  eaBigHitRate: "42mm命中率",
  eaSnipeCnt: "吊射次数",
  avgShootNum: "场均发弹",
  matchLargeEnergyActRoundsAvg: "大能量局均",
  eaExchangeEcon: "兑换经济",
  avgMineTime: "采矿耗时",
  avgMineDiff: "采矿难度",
  avgAssembleDiff: "兑矿等级",
  eaAssembleEcon: "装配经济",
  eaAssembleSuccCnt: "装配成功",
  eaRadarMarkerTime: "标记时长",
  eaRadarDebuffDmg: "易伤伤害",
  eaRadarParseSuccCnt: "解析成功",
  eaRadarCounterTime: "反制时长",
  etDartOutpostCnt: "前哨",
  etDartFixedCnt: "固定",
  etDartRDFixCnt: "随机固定",
  etDartRDMoveCnt: "随机移动",
  etDartEndMoveCnt: "末端移动",
  kills: "K",
  deaths: "D",
  assists: "A",
};

const MODEL_VERSION = "ladder-official-2026";

type RawData = {
  zones?: Array<{
    zoneId: string;
    zoneName: string;
    teams?: Array<{
      collegeName?: string;
      collegeLogo?: string;
      name?: string;
      robots?: Array<Record<string, unknown>>;
    }>;
  }>;
};

let cachedRaw: RawData | null = null;

function loadRaw(): RawData {
  if (cachedRaw) return cachedRaw;
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Missing ${DATA_PATH}`);
  }
  cachedRaw = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")) as RawData;
  return cachedRaw;
}

export function resolveType(robotType: string): string {
  const key = TYPE_MAP[robotType] || TYPE_MAP[robotType.trim()];
  if (!key) throw new Error(`Unknown robot type: ${robotType}`);
  return key;
}

export function parseKda(value: unknown): [number, number, number] {
  const parts = String(value || "0/0/0").split("/");
  return [
    parts[0] ? Number(parts[0]) || 0 : 0,
    parts[1] ? Number(parts[1]) || 0 : 0,
    parts[2] ? Number(parts[2]) || 0 : 0,
  ];
}

export function kdaScore(value: unknown): number {
  const [k, , a] = parseKda(value);
  return k + a * 0.4;
}

export function listZones(): Array<{ zoneId: string; zoneName: string }> {
  return (loadRaw().zones || []).map((z) => ({
    zoneId: z.zoneId,
    zoneName: z.zoneName,
  }));
}

function* iterRobots(opts: { zoneId?: string | null; zoneName?: string | null } = {}) {
  const { zoneId, zoneName } = opts;
  for (const zone of loadRaw().zones || []) {
    if (zoneId && String(zone.zoneId) !== String(zoneId)) continue;
    if (zoneName && zone.zoneName !== zoneName) continue;
    for (const team of zone.teams || []) {
      const school = team.collegeName || "";
      for (const robot of team.robots || []) {
        yield {
          zoneId: String(zone.zoneId),
          zoneName: zone.zoneName,
          school,
          team_name: team.name || "",
          logo: team.collegeLogo,
          robot,
        };
      }
    }
  }
}

function formatG(n: number): string {
  // Approximate Python :g
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

export function getRankings(
  robotType: string,
  opts: {
    region?: string | null;
    zoneId?: string | null;
    sortBy?: string | null;
    limit?: number;
  } = {}
) {
  const { region, zoneId, sortBy, limit = 80 } = opts;
  const typeKey = resolveType(robotType);
  // Season ladder: treat 步兵 / 步兵3 / 步兵4 as one Infantry bucket.
  const fields = [...(TYPE_FIELDS[typeKey] || ["eaKDA"])];
  const defaultSort = LADDER_FIELDS[typeKey]?.field || "ladder_score";
  const sortField = sortBy || defaultSort;

  let zoneName: string | null = null;
  if (region) {
    for (const z of listZones()) {
      if (region.includes(z.zoneName) || z.zoneName.includes(region)) {
        zoneName = z.zoneName;
        break;
      }
    }
    if (!zoneName) zoneName = region;
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const item of iterRobots({ zoneId, zoneName })) {
    const robot = item.robot;
    if (robot.type !== typeKey) continue;
    const [k, d, a] = parseKda(robot.eaKDA);
    const score = kdaScore(robot.eaKDA);
    const metrics: Record<string, unknown> = {};
    for (const f of fields) metrics[f] = robot[f];
    metrics.ladder_score = Math.round(score * 1000) / 1000;
    metrics.kills = k;
    metrics.deaths = d;
    metrics.assists = a;
    const label = TYPE_LABELS[typeKey] || typeKey;
    rows.push({
      school: item.school,
      team_name: item.team_name,
      region: item.zoneName,
      zone_id: item.zoneId,
      logo: item.logo,
      robot_type: label,
      robot_type_key: typeKey,
      robot_number: robot.robotNumber,
      kda: `${formatG(k)}/${formatG(d)}/${formatG(a)}`,
      ladder_score: Math.round(score * 1000) / 1000,
      eagHurt: robot.eagHurt,
      gkDamage: robot.gkDamage,
      gKillCount: robot.gKillCount,
      metrics,
    });
  }

  const sortKeyFn = (r: Record<string, unknown>): number => {
    if (sortField === "ladder_score" || sortField === "eagKdaScore" || sortField === "eaKDA") {
      return Number(r.ladder_score || 0);
    }
    let val = r[sortField];
    if (val == null) val = (r.metrics as Record<string, unknown>)?.[sortField];
    return Number(val || 0) || 0;
  };

  rows.sort((a, b) => sortKeyFn(b) - sortKeyFn(a));
  const limited = rows.slice(0, limit);
  limited.forEach((r, i) => {
    r.rank = i + 1;
  });

  const baseFields = [...fields];
  const allFields =
    USES_KDA.has(typeKey) && !baseFields.includes("ladder_score")
      ? [...baseFields, "ladder_score"]
      : baseFields;
  const labelKeys = USES_KDA.has(typeKey)
    ? [...allFields, "kills", "deaths", "assists"]
    : allFields;
  return {
    robot_type: TYPE_LABELS[typeKey] || typeKey,
    robot_type_key: typeKey,
    region: region ?? null,
    sort_by: sortField,
    sort_label: FIELD_LABELS[sortField] || LADDER_FIELDS[typeKey]?.label || sortField,
    fields: allFields,
    field_labels: Object.fromEntries(labelKeys.map((f) => [f, FIELD_LABELS[f] || f])),
    model_version: MODEL_VERSION,
    source: "LADDER robot_data_2026.json (official season aggregates)",
    items: limited,
  };
}

export function getCompare(robotType: string, schools: string[]) {
  const typeKey = resolveType(robotType);
  const fields = TYPE_FIELDS[typeKey] || ["eaKDA"];
  const schoolList = schools.filter(Boolean).slice(0, 4);
  if (schoolList.length < 2) throw new Error("Need 2–4 schools");

  const ranking = getRankings(robotType, { limit: 500 });
  const bySchool: Record<string, Record<string, unknown> | null> = {};
  for (const s of schoolList) bySchool[s] = null;

  for (const row of ranking.items) {
    const name = String(row.school);
    if (name in bySchool && bySchool[name] == null) {
      bySchool[name] = row;
      continue;
    }
    for (const s of schoolList) {
      if (bySchool[s] == null && (name.includes(s) || s.includes(name))) {
        bySchool[s] = row;
      }
    }
  }

  const teams = schoolList.map((s) => {
    const row = bySchool[s];
    if (!row) return { school: s, found: false, metrics: {} as Record<string, unknown> };
    const metrics: Record<string, unknown> = {};
    for (const f of fields) {
      metrics[f] = (row.metrics as Record<string, unknown>)?.[f] ?? row[f];
    }
    metrics.ladder_score = row.ladder_score;
    metrics.kda = row.kda;
    return {
      school: String(row.school),
      found: true,
      region: row.region as string | undefined,
      logo: row.logo as string | undefined,
      kda: row.kda as string | undefined,
      ladder_score: row.ladder_score as number | undefined,
      metrics,
    };
  });

  const metricNumber = (team: (typeof teams)[number], field: string): number => {
    if (field === "eaKDA" || field === "ladder_score") {
      if (field === "ladder_score" && team.ladder_score != null) {
        return Number(team.ladder_score) || 0;
      }
      return kdaScore(team.kda || team.metrics.eaKDA);
    }
    return Number(team.metrics[field] || 0) || 0;
  };

  const barFields = [...fields.filter((f) => f !== "eaKDA"), "ladder_score"];
  const series = barFields.map((f) => {
    const vals = teams.map((t) => metricNumber(t, f));
    const peak = Math.max(...vals, 0) || 1;
    return {
      field: f,
      label: FIELD_LABELS[f] || f,
      values: teams.map((t, i) => ({
        school: t.school,
        value: vals[i]!,
        ratio: vals[i]! / peak,
      })),
    };
  });

  return {
    robot_type: TYPE_LABELS[typeKey] || typeKey,
    robot_type_key: typeKey,
    fields,
    field_labels: Object.fromEntries(
      [...fields, "ladder_score"].map((f) => [f, FIELD_LABELS[f] || f])
    ),
    teams,
    series,
    model_version: MODEL_VERSION,
  };
}

export function listSchoolsForType(robotType: string, q?: string | null, limit = 40): string[] {
  const ranking = getRankings(robotType, { limit: 300 });
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of ranking.items) {
    const s = String(row.school);
    if (seen.has(s)) continue;
    if (q && !s.includes(q)) continue;
    seen.add(s);
    names.push(s);
    if (names.length >= limit) break;
  }
  return names;
}

function schoolMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function formatRobotLabel(typeKey: string, _robot: Record<string, unknown>): string {
  // LADDER treats infantry as one bucket (no 步兵3/4 season split).
  return TYPE_LABELS[typeKey] || typeKey;
}

/** Parse URL slug like 英雄 / 步兵3 / Hero into type key + optional infantry number. */
export function parseRobotSlug(slug: string): { typeKey: string; robotNumber: number | null; label: string } {
  const raw = decodeURIComponent(slug).trim();
  const m = /^步兵\s*([34])$/.exec(raw) || /^Infantry[_-]?([34])$/i.exec(raw);
  if (m) {
    return { typeKey: "Infantry", robotNumber: Number(m[1]), label: `步兵${m[1]}` };
  }
  const typeKey = resolveType(raw);
  return { typeKey, robotNumber: null, label: TYPE_LABELS[typeKey] || raw };
}

function enrichRobotRow(
  item: {
    school: string;
    zoneName: string;
    zoneId: string;
    logo?: string | null;
    team_name: string;
    robot: Record<string, unknown>;
  },
  rankHint?: number | null
) {
  const typeKey = String(item.robot.type || "");
  const fields = [...(TYPE_FIELDS[typeKey] || ["eaKDA"])];
  const [k, d, a] = parseKda(item.robot.eaKDA);
  const score = kdaScore(item.robot.eaKDA);
  const label = formatRobotLabel(typeKey, item.robot);
  const metrics: Record<string, unknown> = {};
  for (const f of fields) metrics[f] = item.robot[f];
  metrics.ladder_score = Math.round(score * 1000) / 1000;
  metrics.kills = k;
  metrics.deaths = d;
  metrics.assists = a;

  return {
    school: item.school,
    region: item.zoneName,
    zone_id: item.zoneId,
    logo: item.logo,
    team_name: item.team_name,
    robot_type: label,
    robot_type_key: typeKey,
    robot_number: item.robot.robotNumber ?? null,
    slug: label,
    kda: `${formatG(k)}/${formatG(d)}/${formatG(a)}`,
    ladder_score: Math.round(score * 1000) / 1000,
    rank: rankHint ?? null,
    fields: fields.includes("ladder_score") ? fields : [...fields, "ladder_score"],
    field_labels: Object.fromEntries(
      [...fields, "ladder_score", "kills", "deaths", "assists"].map((f) => [
        f,
        FIELD_LABELS[f] || f,
      ])
    ),
    metrics,
    model_version: MODEL_VERSION,
    source: "LADDER robot_data_2026.json (official season aggregates)",
  };
}

/** All LADDER robots for a school (fuzzy name match). */
export function getTeamRobotRoster(school: string) {
  const items = [];
  for (const item of iterRobots()) {
    if (!schoolMatches(item.school, school)) continue;
    items.push(enrichRobotRow(item));
  }
  // Prefer exact college name first, then fuzzy
  const exact = items.filter((r) => r.school === school);
  const use = exact.length ? exact : items;
  // Dedupe by type key (Infantry is one LADDER slot, not 3/4)
  const seen = new Set<string>();
  const deduped = [];
  for (const r of use) {
    const key = String(r.robot_type_key);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  deduped.sort((a, b) => String(a.robot_type_key).localeCompare(String(b.robot_type_key)));
  return {
    school,
    model_version: MODEL_VERSION,
    items: deduped,
  };
}

/** One robot under a school: season metrics + approximate type rank. */
export function getTeamRobotDetail(school: string, robotSlug: string) {
  const { typeKey, robotNumber, label } = parseRobotSlug(robotSlug);
  const ranking = getRankings(TYPE_LABELS[typeKey] || typeKey, { limit: 500 });

  let matched: ReturnType<typeof enrichRobotRow> | null = null;
  for (const item of iterRobots()) {
    if (!schoolMatches(item.school, school)) continue;
    if (String(item.robot.type) !== typeKey) continue;
    if (robotNumber != null && Number(item.robot.robotNumber) !== robotNumber) continue;
    matched = enrichRobotRow(item);
    if (item.school === school) break;
  }
  if (!matched) return null;

  // Rank among same type (and number for infantry when present)
  let rank: number | null = null;
  for (const row of ranking.items) {
    if (!schoolMatches(String(row.school), matched.school)) continue;
    if (robotNumber != null && Number(row.robot_number) !== robotNumber) continue;
    rank = Number(row.rank);
    break;
  }
  matched.rank = rank;

  return matched;
}
