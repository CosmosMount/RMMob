from fastapi import APIRouter, HTTPException, Query

from app.services import ladder_stats

router = APIRouter(prefix="/rankings", tags=["rankings"])


@router.get("")
def rankings(
    robot_type: str = Query("英雄"),
    region: str | None = None,
    zone_id: str | None = None,
    sort_by: str | None = None,
    limit: int = Query(60, ge=1, le=300),
):
    try:
        return ladder_stats.get_rankings(
            robot_type,
            region=region,
            zone_id=zone_id,
            sort_by=sort_by,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e


@router.get("/zones")
def zones():
    try:
        return {"items": ladder_stats.list_zones()}
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e


@router.get("/schools")
def schools(robot_type: str = Query("英雄"), q: str | None = None, limit: int = 40):
    try:
        return {"items": ladder_stats.list_schools_for_type(robot_type, q=q, limit=limit)}
    except Exception as e:
        raise HTTPException(400, str(e)) from e
