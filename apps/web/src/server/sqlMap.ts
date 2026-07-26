/** SQLite column names (Chinese headers in source dump). */

const COLS: Record<string, string> = {
  region: "赛区",
  match_no: "场次号",
  schedule: "赛程",
  round_no: "局号",
  game_id: "game_id",
  web_game_id: "web_game_id",
  red_school: "红方学校",
  blue_school: "蓝方学校",
  winner: "胜方",
  start_time: "开始时间",
  duration_sec: "时长秒",
  second: "时刻秒",
  robot_id: "robot_id",
  robot_type: "机器人类型",
  team: "阵营",
  school: "学校名",
  opponent_school: "对手学校",
  hp: "当前血量",
  hp_max: "最大血量",
  x: "x",
  y: "y",
  z: "z",
  orientation: "枪口朝向",
  chassis_power: "底盘功率",
  heat_17: "小热量",
  heat_17_max: "小热量上限",
  heat_42: "大热量",
  heat_42_max: "大热量上限",
  ammo_17: "累计17mm发弹",
  ammo_42: "累计42mm发弹",
  gold_total: "队伍总金币",
  gold_remain: "队伍剩余金币",
  vulnerable: "是否易伤",
  event_type: "事件类型",
  target_robot_id: "目标robot_id",
  target_type: "目标类型",
  category: "类别",
  value: "数值",
  note: "备注",
};

function qident(name: string): string {
  return `"${name}"`;
}

export function col(key: string): string {
  const name = COLS[key];
  if (!name) throw new Error(`Unknown column key: ${key}`);
  return qident(name);
}
