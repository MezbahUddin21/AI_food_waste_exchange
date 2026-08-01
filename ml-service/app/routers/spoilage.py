from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.rules import spoilage_rules

router = APIRouter(prefix="/predict", tags=["spoilage"])


class SpoilageRequest(BaseModel):
    food_category: str = Field(examples=["cooked_meal"])
    prepared_at: datetime
    storage: str = Field(examples=["refrigerated"])
    packaging: str = Field(examples=["covered"])
    ambient_temp_c: float | None = None


class SpoilageResponse(BaseModel):
    pickup_window_start: str
    pickup_window_end: str
    shelf_hours: float
    confidence: float


@router.post("/spoilage", response_model=SpoilageResponse)
def predict_spoilage(req: SpoilageRequest):
    return spoilage_rules.predict(
        food_category=req.food_category,
        prepared_at=req.prepared_at,
        storage=req.storage,
        packaging=req.packaging,
        ambient_temp_c=req.ambient_temp_c,
    )
