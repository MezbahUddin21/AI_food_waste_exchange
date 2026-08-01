"""
NGO ranking — weighted linear scorer.

score = w_dist * distance_score
      + w_cap  * capacity_score
      + w_type * category_match
      + w_rel  * reliability

Interpretable and tunable; the weights become learnable parameters once
accept/decline outcome data exists.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/rank", tags=["ranking"])

W_DISTANCE = 0.40
W_CAPACITY = 0.20
W_CATEGORY = 0.25
W_RELIABILITY = 0.15
MAX_KM = 25.0


class DonationInfo(BaseModel):
    food_category: str
    quantity_servings: int


class NgoCandidate(BaseModel):
    ngo_id: str
    distance_km: float
    capacity_meals_per_day: int
    accepts_category: bool
    reliability_score: float = 1.0


class RankRequest(BaseModel):
    donation: DonationInfo
    candidates: list[NgoCandidate]


class RankedNgo(NgoCandidate):
    score: float


class RankResponse(BaseModel):
    ranked: list[RankedNgo]


def score_candidate(donation: DonationInfo, c: NgoCandidate) -> float:
    distance_score = max(0.0, 1.0 - c.distance_km / MAX_KM)
    # Can the NGO absorb this quantity in a day? Saturates at 1.
    capacity_score = min(1.0, c.capacity_meals_per_day / max(1, donation.quantity_servings))
    category_score = 1.0 if c.accepts_category else 0.0
    reliability = max(0.0, min(1.0, c.reliability_score))

    return round(
        W_DISTANCE * distance_score
        + W_CAPACITY * capacity_score
        + W_CATEGORY * category_score
        + W_RELIABILITY * reliability,
        4,
    )


@router.post("/ngos", response_model=RankResponse)
def rank_ngos(req: RankRequest):
    ranked = [
        RankedNgo(**c.model_dump(), score=score_candidate(req.donation, c))
        for c in req.candidates
    ]
    ranked.sort(key=lambda r: r.score, reverse=True)
    return {"ranked": ranked}
