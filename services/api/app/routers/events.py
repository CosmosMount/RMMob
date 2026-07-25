from fastapi import APIRouter, Query

from app.schemas.models import EventsResponse
from app.services import rounds as round_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/{game_id}", response_model=EventsResponse)
def events(
    game_id: str,
    team: str | None = None,
    robot_type: str | None = None,
    collapse_shots: bool = True,
    limit: int = Query(500, ge=1, le=5000),
):
    return round_service.list_events(
        game_id,
        team=team,
        robot_type=robot_type,
        collapse_shots=collapse_shots,
        limit=limit,
    )
