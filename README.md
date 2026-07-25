# RMMob

RoboMaster 高校赛（RMUC）数据分析前端：FotMob 风格的比赛叙事，并融合战队 / 兵种入口。

局内地图、软热力、Momentum、官方同源排行与多校对比；暗色主题。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Web | Next.js（App Router）+ TypeScript |
| API | FastAPI + NumPy |
| 存储 | 默认 SQLite；可选 PostgreSQL |
| 导入 | `pipelines/ingest`：SQLite → PostgreSQL |

## 快速开始

### 1. API

```bash
# 在仓库根目录
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
# source .venv/bin/activate

pip install -r services/api/requirements.txt
cd services/api
python -m uvicorn app.main:app --reload --port 8000
```

默认读取：

```text
rmuc_2026_region_dataset/rmuc_2026_region_dataset.sqlite
```

导入 Postgres 后可设置环境变量：

```text
DATABASE_URL=postgresql://rmmob:rmmob@localhost:5432/rmmob
```

### 2. Web

```bash
cd apps/web
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。浏览器请求 `/api/*`，由 Next.js 代理到 FastAPI `:8000`。

### 3. 可选：PostgreSQL 导入

```bash
docker compose up -d
cd pipelines/ingest
python ingest.py \
  --sqlite ../../rmuc_2026_region_dataset/rmuc_2026_region_dataset.sqlite \
  --database-url postgresql://rmmob:rmmob@localhost:5432/rmmob
```

## 功能导航

| 页面 | 说明 |
| --- | --- |
| 首页 | 中间赛程；左侧学校积分榜；右侧兵种榜（可切换兵种） |
| Matches | 赛区筛选 + 学校下拉搜索；局详情（播放 / 热力 / 血条 HUD） |
| Teams | 学校检索与赛季概览 |
| Rankings | 官方同源赛季兵种榜，列可排序 |
| Compare | 同兵种 2–4 校对比条 + 表（无蛛网图） |
| Robots / Analytics | 跨场切片与概览 |

## 数据来源（两套，勿混用）

| 来源 | 内容 | 用途 |
| --- | --- | --- |
| 区域赛 SQLite（或 PG） | `matches` / `timeseries` / `events` | 赛程、局内快照、轨迹、Momentum、热力、局内统计、学校积分 |
| `services/api/data/robot_data_2026.json` | LADDER 同源赛季聚合 | Rankings / Compare（KDA、平均伤害等） |
| `college_logos.json` + `apps/web/public/crests` | 校徽 | UI 展示 |

**说明：** 官方同款 K/D/A **不能**从本仓库 SQLite 的「受击」反推（无攻击者字段）。排行页数据为赛季官方统计（LADDER 同源）。

场地图：`apps/web/public/field/rmuc_2026_field_top_view.jpeg`（已去白边）。世界坐标约 $0\sim 28\,\mathrm{m}\times 0\sim 15\,\mathrm{m}$，经 `FIELD_IMAGE_INSET` 映射到图内可玩区。

---

## 指标与计算方式

下列描述对应当前实现；版本号以各接口返回的 `model_version` 为准。

行内公式用 `$...$`；独立公式用 fenced `math` 代码块（GitHub 可渲染）。

### 1. Momentum（局内局势）

- **代码：** `services/api/app/services/momentum.py`
- **版本：** `momentum-v1.0`
- **符号：** 红方优势为正，蓝方为负。基地 / 前哨只进 objective，不进地面 HP / 弹药。

**伤害压力（递推）：** 对事件 `受击`、`飞镖命中`，受害方的对手累加压力 $p_t$，再：

```math
\mathrm{acc}_t = 0.92\,\mathrm{acc}_{t-1} + p_t
```

**每秒分项（红 − 蓝）：**

| 符号 | 含义 |
| --- | --- |
| $h$ | 非建筑 $\sum(\mathrm{hp}/\mathrm{hp\_max})$ |
| $d$ | $(\mathrm{acc}_\mathrm{R}-\mathrm{acc}_\mathrm{B})/200$ |
| $e$ | $(\mathrm{gold}_\mathrm{R}-\mathrm{gold}_\mathrm{B})/500$ |
| $g$ | 建筑 $\sum(\mathrm{hp}/\mathrm{hp\_max})$ |
| $s$ | $(\mathrm{ammo}_{17+42,\mathrm{R}}-\mathrm{ammo}_{17+42,\mathrm{B}})/200$ |
| $p$ | $-(|\bar{x}_\mathrm{R}-14|-|\bar{x}_\mathrm{B}-14|)/10$；缺坐标则为 $0$ |

**原始分：**

```math
\mathrm{raw} = 0.35h + 0.25d + 0.1e + 0.1p + 0.1g + 0.05s
```

**平滑：** 用中位数与 MAD 做稳健标准化，截断到 $\pm 3$，再 EMA（$\alpha=0.2$）：

```math
s_t = \alpha\, z_t + (1-\alpha)\, s_{t-1}
```

前端 Momentum 图：零轴上下红 / 蓝分区填充。

---

### 2. 热力图

- **采样 API：** `services/api/app/services/viz.py`
- **渲染：** `apps/web/src/lib/heatmap.ts`

**构建（对齐 LADDER）：**

1. 只用场地内坐标：$x\in[0,28]$，$y\in[0,15]$。
2. 落入 $60\times 60$ 网格：

```math
g_x=\left\lfloor\frac{x-x_{\min}}{x_{\mathrm{range}}}\cdot 59\right\rfloor,\quad
g_y=\left\lfloor\frac{y-y_{\min}}{y_{\mathrm{range}}}\cdot 59\right\rfloor
```

3. 格内累加权重 → 按全局最大值归一 → 再用 $\log(1+\mathrm{count})$ 缓和高峰。

**指标：**

| metric | 采样 |
| --- | --- |
| `movement` | `timeseries` 每个在界样本，$\mathrm{weight}=1$ |
| `shooting` | `发弹` 与同时刻坐标 JOIN |
| `damage` | `受击`，$\mathrm{weight}=|\mathrm{value}|$ |

**播放逻辑：** 播放中 $\mathrm{end}=\mathrm{currentSecond}$（累计实时热力）；暂停 / 未播放为全场热力。

**形态：** 够热的格子画 FotMob 风格软圆斑（绿边 → 黄 → 橙心），映射到去白边场地图。

---

### 3. 赛季排行 / 兵种对比（官方 JSON）

- **代码：** `services/api/app/services/ladder_stats.py`
- **数据：** `services/api/data/robot_data_2026.json`
- **版本：** `ladder-official-2026`

**步兵分（LADDER 默认）：** 解析 `eaKDA` 字符串 `k/d/a`：

```math
\mathrm{ladder\_score} = K + 0.4A
```

**各兵种默认排序字段：**

| 兵种 | 字段 | 含义 |
| --- | --- | --- |
| 步兵 | `ladder_score` | $K+0.4A$ |
| 英雄 / 飞镖 | `gkDamage` | 平均伤害 |
| 工程 | `eaExchangeEcon` 等 | 兑换 / 装配经济 |
| 空中 / 哨兵 | `eagHurt` | 造成伤害量 |
| 雷达 | `eaRadarMarkerTime` 等 | 标记 / 易伤相关 |

**Compare：** 同兵种下每校取榜上最优机体；对比条：

```math
\mathrm{ratio}=\frac{v}{\max(v)}
```

不做雷达蛛网图。

---

### 4. 局内统计条（Statistics）

**代码：** `services/api/app/services/rounds.py` → `get_statistics`

| 指标 | 计算 |
| --- | --- |
| **造成伤害** | 各机 `damage_dealt` = 本机「受击」绝对值之和；红方造成伤害 = 蓝方承伤合计（对称） |
| 17mm / 42mm 发弹 | 该秒快照弹药按阵营求和 |
| 剩余血量 | 非建筑 HP 求和 |
| 移动距离 | 队内各机轨迹折线长之和 |
| 剩余金币 | 该阵营首个有效的 `gold_remain` |

血条 UI（BattleScope 风格）：顶部前哨 / 基地；左右侧地面机器人血量 + 发弹；播放时随 `at_second` 刷新。

---

### 5. 学校积分榜（首页左侧）

**代码：** `services/api/app/services/matches.py` → `school_standings`

- 按「一场对阵」的多局系列（同赛区 / 场次 / 红蓝校）统计胜负平。
- 系列红胜局数 $>$ 蓝 → 红校胜；反之蓝胜；相等为平。
- **积分：**

```math
\mathrm{pts}=3\cdot\mathrm{won}+\mathrm{drawn}
```

- **排序：** $(\mathrm{pts},\,\mathrm{won},\,\mathrm{played})$ 降序。

---

### 6. 局内 Quick Stats

**代码：** `rounds.get_round_detail`

| 字段 | 计算 |
| --- | --- |
| `red_hp` / `blue_hp` | 非建筑 HP 之和 |
| `red_alive` / `blue_alive` | 非建筑且 $\mathrm{hp}>0$ 的数量 |
| `red_gold` / `blue_gold` | 该队首个非空 `gold_remain` |
| `at_second` | 当前采样秒（默认终局；播放时为当前秒） |

---

### 7. 轨迹与距离

**代码：** `viz.get_trajectory` / `rounds._distance_for_robot`

对有序坐标点：

```math
\mathrm{distance}=\sum_i\sqrt{(\Delta x_i)^2+(\Delta y_i)^2}
```

仅在连续观测段累加；缺测点断开后重置。播放时地图位置优先用已加载轨迹按秒取值，HP 等仍按秒拉快照。

机器人序号：红方 $1$–$7$；蓝方 $101$–$107$ 显示为 $1$–$7$（$\mathrm{id}\bmod 100$）。

---

### 8. Robots 索引页

**代码：** `aggregate.list_robot_index`

对有限场次样本做 `学校 × 兵种 × 赛区` 聚合（带缓存），避免全表海量行实时 `GROUP BY` 拖垮接口。

---

## 仓库结构（简）

```text
apps/web/                  Next.js 前端
services/api/              FastAPI
services/api/data/         robot_data_2026.json
pipelines/ingest/          SQLite → PG
rmuc_2026_region_dataset/  区域赛 SQLite
assets/                    原始场地图等资源
```

## 说明

- 产品规格若存在于本地 `.agents/docs/`，仅作开发参考，**不保证随仓库公开**。
- 本 README 描述**当前实现**；若代码变更，以接口 `model_version` 与对应源文件为准。
