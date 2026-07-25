from fastapi import APIRouter, HTTPException, Query

from app.schemas.models import TrajectoryResponse
from app.services.viz import get_trajectory, list_robot_ids

router = APIRouter(prefix="/trajectory", tags=["trajectory"])


@router.get("/{game_id}/robots")
def robots(game_id: str, team: str | None = None, robot_type: str | None = None):
    return {"items": list_robot_ids(game_id, team=team, robot_type=robot_type)}


@router.get("/{game_id}/{robot_id}", response_model=TrajectoryResponse)
def trajectory(
    game_id: str,
    robot_id: str,
    start: int | None = None,
    end: int | None = None,
):
    result = get_trajectory(game_id, robot_id, start=start, end=end)
    if not result:
        raise HTTPException(404, "trajectory not found")
    return result
