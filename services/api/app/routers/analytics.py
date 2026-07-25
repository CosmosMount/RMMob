from fastapi import APIRouter

from app.services.aggregate import analytics_overview

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def overview():
    return analytics_overview()
