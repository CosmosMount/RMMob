from fastapi import APIRouter, Query

from app.services.aggregate import list_robot_index

router = APIRouter(prefix="/robots", tags=["robots"])


@router.get("")
def robots(limit: int = Query(100, ge=1, le=500)):
    return {"items": list_robot_index(limit=limit)}
