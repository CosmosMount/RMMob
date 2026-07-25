from fastapi import APIRouter, HTTPException

from app.schemas.models import TeamSummary
from app.services.aggregate import get_team

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("/{school}", response_model=TeamSummary)
def team(school: str):
    result = get_team(school)
    if not result:
        raise HTTPException(404, "team not found")
    return result
