from __future__ import annotations

from pydantic import BaseModel, Field


class MatchRoundSummary(BaseModel):
    game_id: str
    region: str
    match_no: int
    schedule: str
    round_no: int
    red_school: str
    blue_school: str
    winner: str | None = None
    start_time: str | None = None
    duration_sec: int | None = None


class MatchGroup(BaseModel):
    match_key: str
    region: str
    match_no: int
    schedule: str
    red_school: str
    blue_school: str
    rounds: list[MatchRoundSummary]
    red_wins: int = 0
    blue_wins: int = 0


class MatchListResponse(BaseModel):
    total: int
    items: list[MatchGroup]


class RobotSnapshot(BaseModel):
    robot_id: str
    robot_type: str
    team: str
    school: str
    hp: float | None = None
    hp_max: float | None = None
    x: float | None = None
    y: float | None = None
    z: float | None = None
    orientation: float | None = None
    ammo_17: float | None = None
    ammo_42: float | None = None
    gold_total: float | None = None
    gold_remain: float | None = None
    vulnerable: int | None = None
    damage_dealt: float = 0
    distance: float = 0
    status: str = "active"


class RoundDetail(BaseModel):
    game_id: str
    region: str
    match_no: int
    schedule: str
    round_no: int
    red_school: str
    blue_school: str
    winner: str | None = None
    start_time: str | None = None
    duration_sec: int
    match_key: str
    sibling_rounds: list[MatchRoundSummary]
    red_wins: int = 0
    blue_wins: int = 0
    robots: list[RobotSnapshot] = Field(default_factory=list)
    quick_stats: dict[str, float | int | None] = Field(default_factory=dict)


class EventItem(BaseModel):
    second: int
    event_type: str
    robot_id: str | None = None
    robot_type: str | None = None
    team: str | None = None
    school: str | None = None
    target_robot_id: str | None = None
    target_type: str | None = None
    category: str | None = None
    value: float | None = None
    note: str | None = None
    importance: str = "minor"


class EventsResponse(BaseModel):
    game_id: str
    total: int
    items: list[EventItem]


class StatBar(BaseModel):
    metric: str
    label: str
    red: float
    blue: float


class StatisticsResponse(BaseModel):
    game_id: str
    bars: list[StatBar]


class MomentumPoint(BaseModel):
    second: int
    raw: float
    bounded: float
    smoothed: float
    dominant_factor: str | None = None
    contributions: dict[str, float]


class MomentumResponse(BaseModel):
    game_id: str
    model_version: str
    sign_convention: str = "positive-red"
    smoothing: dict[str, float | str]
    points: list[MomentumPoint]


class TrajectoryPoint(BaseModel):
    second: int
    x: float | None
    y: float | None
    z: float | None = None
    hp: float | None = None
    orientation: float | None = None
    observed: bool = True


class TrajectoryResponse(BaseModel):
    game_id: str
    robot_id: str
    team: str
    robot_type: str
    points: list[TrajectoryPoint]
    estimated_distance_2d: float
    segments: list[dict] = Field(default_factory=list)


class HeatmapSample(BaseModel):
    x: float
    y: float
    weight: float = 1.0


class HeatmapResponse(BaseModel):
    game_id: str
    entity_scope: str
    entity_id: str | None
    metric: str
    time_range: list[int]
    coordinate_bounds: dict[str, float]
    bandwidth: float
    normalization: dict[str, float | str | int]
    samples: list[HeatmapSample]
    model_version: str


class TeamSummary(BaseModel):
    school: str
    region_counts: dict[str, int]
    matches_played: int
    rounds_played: int
    rounds_won: int
    win_rate: float
    recent_matches: list[MatchGroup]


class RankingRow(BaseModel):
    rank: int
    school: str
    region: str | None = None
    robot_type: str
    rounds: int
    damage: float
    ammo_17: float
    ammo_42: float
    distance: float
    avg_hp_ratio: float


class RankingsResponse(BaseModel):
    robot_type: str
    region: str | None
    model_version: str
    items: list[RankingRow]
