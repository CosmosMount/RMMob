from fastapi import APIRouter, HTTPException, Query

from app.schemas.models import RoundDetail, StatisticsResponse
from app.services import rounds as round_service

router = APIRouter(prefix="/rounds", tags=["rounds"])


@router.get("/{game_id}", response_model=RoundDetail)
def get_round(game_id: str, at_second: int | None = Query(None)):
    detail = round_service.get_round_detail(game_id, at_second=at_second)
    if not detail:
        raise HTTPException(404, "round not found")
    return detail


@router.get("/{game_id}/statistics", response_model=StatisticsResponse)
def statistics(game_id: str):
    return round_service.get_statistics(game_id)
