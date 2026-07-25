from fastapi import APIRouter, Query

from app.schemas.models import HeatmapResponse
from app.services.viz import get_heatmap

router = APIRouter(prefix="/heatmap", tags=["heatmap"])


@router.get("/{game_id}", response_model=HeatmapResponse)
def heatmap(
    game_id: str,
    metric: str = Query("movement"),
    team: str | None = None,
    robot_type: str | None = None,
    robot_id: str | None = None,
    start: int | None = None,
    end: int | None = None,
):
    return get_heatmap(
        game_id,
        metric=metric,
        team=team,
        robot_type=robot_type,
        robot_id=robot_id,
        start=start,
        end=end,
    )
