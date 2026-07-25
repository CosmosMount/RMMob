from fastapi import APIRouter, HTTPException, Query

from app.services import ladder_stats

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("")
def compare(
    robot_type: str = Query("英雄"),
    schools: str = Query(..., description="Comma-separated school names, 2–4"),
):
    school_list = [s.strip() for s in schools.split(",") if s.strip()]
    try:
        return ladder_stats.get_compare(robot_type, school_list)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(503, str(e)) from e
