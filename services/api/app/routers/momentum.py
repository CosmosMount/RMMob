from fastapi import APIRouter

from app.schemas.models import MomentumResponse
from app.services.momentum import compute_momentum

router = APIRouter(prefix="/momentum", tags=["momentum"])


@router.get("/{game_id}", response_model=MomentumResponse)
def momentum(game_id: str):
    return compute_momentum(game_id)
