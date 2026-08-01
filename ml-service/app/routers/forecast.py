"""
Demand forecasting — v1 stub with a clear upgrade path.

Today: returns a naive seasonal baseline (weekday/hour-of-day pattern) so the
frontend can render a forecast panel. Once ~3 months of donation + emergency
request history exists, replace `naive_forecast` with a trained model
(start with per-area Holt-Winters or LightGBM on lagged features; the request/
response contract below stays identical).
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/forecast", tags=["forecast"])

# Relative demand weights by weekday (0=Mon) — weekends see higher shelter demand.
WEEKDAY_WEIGHT = [1.0, 0.95, 0.95, 1.0, 1.1, 1.3, 1.25]


class ForecastRequest(BaseModel):
    lat: float
    lng: float
    days: int = Field(default=7, ge=1, le=14)


class ForecastPoint(BaseModel):
    date: str
    predicted_servings: int
    confidence: str  # low | medium | high


class ForecastResponse(BaseModel):
    model_version: str
    points: list[ForecastPoint]


BASELINE_SERVINGS = 120  # placeholder area baseline until real history exists


@router.post("/demand", response_model=ForecastResponse)
def forecast_demand(req: ForecastRequest):
    today = datetime.now(timezone.utc).date()
    points = []
    for i in range(req.days):
        day = today + timedelta(days=i + 1)
        weight = WEEKDAY_WEIGHT[day.weekday()]
        points.append(
            ForecastPoint(
                date=day.isoformat(),
                predicted_servings=int(BASELINE_SERVINGS * weight),
                confidence="low",  # honest: this is a baseline, not a trained model
            )
        )
    return {"model_version": "naive-seasonal-v0", "points": points}
