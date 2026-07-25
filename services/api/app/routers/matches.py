from fastapi import APIRouter, Query

from app.schemas.models import MatchListResponse
from app.services import matches as match_service

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=MatchListResponse)
def list_matches(
    region: str | None = None,
    school: str | None = None,
    limit: int = Query(40, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    total, items = match_service.list_matches(region=region, school=school, limit=limit, offset=offset)
    return MatchListResponse(total=total, items=items)


@router.get("/regions")
def regions():
    return {"items": match_service.list_regions()}


@router.get("/schools")
def schools(q: str | None = None, limit: int = Query(40, ge=1, le=200)):
    return {"items": match_service.list_schools(q=q, limit=limit)}


@router.get("/standings")
def standings(limit: int = Query(15, ge=1, le=50)):
    return {"items": match_service.school_standings(limit=limit)}


@router.get("/{match_key}")
def get_match(match_key: str):
    group = match_service.get_match_group(match_key)
    if not group:
        return {"error": "not_found"}
    return group
