export type MatchRoundSummary = {
  game_id: string;
  region: string;
  match_no: number;
  schedule: string;
  round_no: number;
  red_school: string;
  blue_school: string;
  winner: string | null;
  start_time: string | null;
  duration_sec: number | null;
};

export type MatchGroup = {
  match_key: string;
  region: string;
  match_no: number;
  schedule: string;
  red_school: string;
  blue_school: string;
  rounds: MatchRoundSummary[];
  red_wins: number;
  blue_wins: number;
};

export type RobotSnapshot = {
  robot_id: string;
  robot_type: string;
  team: string;
  school: string;
  hp: number | null;
  hp_max: number | null;
  x: number | null;
  y: number | null;
  orientation: number | null;
  ammo_17: number | null;
  ammo_42: number | null;
  gold_remain: number | null;
  vulnerable: number | null;
  damage_dealt: number;
  distance: number;
  status: string;
};

export type RoundDetail = {
  game_id: string;
  region: string;
  match_no: number;
  schedule: string;
  round_no: number;
  red_school: string;
  blue_school: string;
  winner: string | null;
  start_time: string | null;
  duration_sec: number;
  match_key: string;
  sibling_rounds: MatchRoundSummary[];
  red_wins: number;
  blue_wins: number;
  robots: RobotSnapshot[];
  quick_stats: Record<string, number | null>;
};

export type MomentumPoint = {
  second: number;
  raw: number;
  bounded: number;
  smoothed: number;
  dominant_factor: string | null;
  contributions: Record<string, number>;
};

export type MomentumResponse = {
  game_id: string;
  model_version: string;
  points: MomentumPoint[];
};

export type HeatmapSample = { x: number; y: number; weight: number };

export type HeatmapResponse = {
  game_id: string;
  metric: string;
  time_range: number[];
  coordinate_bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  bandwidth: number;
  samples: HeatmapSample[];
  model_version: string;
};

export type TrajectoryResponse = {
  game_id: string;
  robot_id: string;
  team: string;
  robot_type: string;
  points: Array<{
    second: number;
    x: number | null;
    y: number | null;
    observed: boolean;
  }>;
  estimated_distance_2d: number;
};

export type EventItem = {
  second: number;
  event_type: string;
  robot_id: string | null;
  robot_type: string | null;
  team: string | null;
  category: string | null;
  value: number | null;
  note: string | null;
  importance: string;
};

export type StatBar = {
  metric: string;
  label: string;
  red: number;
  blue: number;
};
