from fastapi import APIRouter

from app.config import settings
from app.db import using_postgres

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "backend": "postgres" if using_postgres() else "sqlite",
        "sqlite_path": str(settings.sqlite_path),
        "sqlite_exists": settings.sqlite_path.exists(),
    }
