from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    analytics,
    compare,
    events,
    health,
    heatmap,
    matches,
    momentum,
    rankings,
    robots,
    rounds,
    teams,
    trajectory,
)


def create_app() -> FastAPI:
    app = FastAPI(title="RMMob API", version="0.1.0")
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    prefix = settings.api_prefix
    app.include_router(health.router, prefix=prefix)
    app.include_router(matches.router, prefix=prefix)
    app.include_router(rounds.router, prefix=prefix)
    app.include_router(events.router, prefix=prefix)
    app.include_router(momentum.router, prefix=prefix)
    app.include_router(heatmap.router, prefix=prefix)
    app.include_router(trajectory.router, prefix=prefix)
    app.include_router(teams.router, prefix=prefix)
    app.include_router(rankings.router, prefix=prefix)
    app.include_router(compare.router, prefix=prefix)
    app.include_router(robots.router, prefix=prefix)
    app.include_router(analytics.router, prefix=prefix)
    return app


app = create_app()
