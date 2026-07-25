-- RMMob PostgreSQL schema (normalized English columns)

CREATE TABLE IF NOT EXISTS matches (
    game_id TEXT PRIMARY KEY,
    region TEXT NOT NULL,
    match_no INTEGER NOT NULL,
    schedule TEXT NOT NULL,
    round_no INTEGER NOT NULL,
    web_game_id TEXT,
    red_school TEXT NOT NULL,
    blue_school TEXT NOT NULL,
    winner TEXT,
    start_time TEXT,
    duration_sec INTEGER
);

CREATE INDEX IF NOT EXISTS idx_matches_region_match ON matches (region, match_no);
CREATE INDEX IF NOT EXISTS idx_matches_schools ON matches (red_school, blue_school);

CREATE TABLE IF NOT EXISTS timeseries (
    game_id TEXT NOT NULL,
    second INTEGER NOT NULL,
    robot_id TEXT NOT NULL,
    region TEXT,
    match_no INTEGER,
    schedule TEXT,
    round_no INTEGER,
    robot_type TEXT,
    team TEXT,
    school TEXT,
    opponent_school TEXT,
    hp DOUBLE PRECISION,
    hp_max DOUBLE PRECISION,
    x DOUBLE PRECISION,
    y DOUBLE PRECISION,
    z DOUBLE PRECISION,
    orientation DOUBLE PRECISION,
    chassis_power DOUBLE PRECISION,
    heat_17 DOUBLE PRECISION,
    heat_17_max DOUBLE PRECISION,
    heat_42 DOUBLE PRECISION,
    heat_42_max DOUBLE PRECISION,
    ammo_17 DOUBLE PRECISION,
    ammo_42 DOUBLE PRECISION,
    gold_total DOUBLE PRECISION,
    gold_remain DOUBLE PRECISION,
    vulnerable INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ts_game_second ON timeseries (game_id, second);
CREATE INDEX IF NOT EXISTS idx_ts_game_robot ON timeseries (game_id, robot_id, second);
CREATE INDEX IF NOT EXISTS idx_ts_school_type ON timeseries (school, robot_type);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    game_id TEXT NOT NULL,
    second INTEGER NOT NULL,
    region TEXT,
    match_no INTEGER,
    schedule TEXT,
    round_no INTEGER,
    robot_id TEXT,
    robot_type TEXT,
    team TEXT,
    school TEXT,
    event_type TEXT,
    target_robot_id TEXT,
    target_type TEXT,
    category TEXT,
    value DOUBLE PRECISION,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_ev_game_second ON events (game_id, second);
CREATE INDEX IF NOT EXISTS idx_ev_game_type ON events (game_id, event_type);
