# RMMob

RoboMaster University Championship analytics platform — FotMob-style match storytelling with team and robot-type entry points.

## Stack

| Layer | Tech |
| --- | --- |
| Web | Next.js (App Router) + TypeScript |
| API | FastAPI + NumPy |
| Store | PostgreSQL (preferred) or source SQLite fallback |
| Ingest | `pipelines/ingest` SQLite → PostgreSQL |

## Quick start

### 1. API

```powershell
cd D:\Workspace\projects\RMMob
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r services\api\requirements.txt
cd services\api
..\..\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

By default the API reads `rmuc_2026_region_dataset/rmuc_2026_region_dataset.sqlite`.  
Set `DATABASE_URL=postgresql://rmmob:rmmob@localhost:5432/rmmob` after ingest to use Postgres.

### 2. Web

```powershell
cd apps\web
npm install
npm run dev
```

Open http://localhost:3000. The browser calls `/api/*`, rewritten to the FastAPI server.

### 3. Optional PostgreSQL ingest

```powershell
docker compose up -d
cd pipelines/ingest
python ingest.py --sqlite ..\..\rmuc_2026_region_dataset\rmuc_2026_region_dataset.sqlite --database-url postgresql://rmmob:rmmob@localhost:5432/rmmob
```

## Navigation

- **Matches** — region / school search, match → round detail
- **Teams** — school season view
- **Rankings** — robot-type ladders
- **Robots / Analytics** — cross-match slices

## Docs

Product specs live under `.agents/docs/` (agent workspace; gitignored).
