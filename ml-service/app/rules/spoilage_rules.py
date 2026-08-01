"""
Spoilage prediction — v1 rule-based model.

Structured as: base shelf-life lookup per food category, adjusted by storage,
packaging, and ambient temperature. Deliberately interpretable — every number
here is defensible to a food-safety reviewer, and the module exposes the same
interface a trained regressor would (predict(features) -> hours), so it can be
swapped for XGBoost/LightGBM once real pickup-outcome data accumulates.

Sources for baselines: USDA food safety guidance (2-hour/4-hour rule for
cooked food at room temp, refrigeration windows per category).
"""
from datetime import datetime, timedelta, timezone

# Base shelf life in hours, measured from preparation time, at room temperature.
BASE_SHELF_HOURS = {
    "cooked_meal": 4,      # USDA: discard cooked food after ~4h in the danger zone
    "bakery": 24,
    "produce": 48,
    "dairy": 24,
    "packaged": 24 * 30,   # sealed shelf-stable goods
    "other": 12,
}

STORAGE_MULTIPLIER = {
    "hot_held": 0.75,      # hot-holding slows growth but quality degrades fast
    "room_temp": 1.0,
    "refrigerated": 3.0,
    "frozen": 12.0,
}

PACKAGING_MULTIPLIER = {
    "sealed": 1.25,
    "covered": 1.0,
    "open": 0.75,
}


def _temp_multiplier(ambient_c: float | None, storage: str) -> float:
    """Above ~25°C ambient, unrefrigerated shelf life shrinks quickly."""
    if ambient_c is None or storage in ("refrigerated", "frozen"):
        return 1.0
    if ambient_c >= 35:
        return 0.5
    if ambient_c >= 30:
        return 0.65
    if ambient_c >= 25:
        return 0.8
    return 1.0


def predict(
    food_category: str,
    prepared_at: datetime,
    storage: str,
    packaging: str,
    ambient_temp_c: float | None = None,
) -> dict:
    base = BASE_SHELF_HOURS.get(food_category, 12)
    shelf_hours = (
        base
        * STORAGE_MULTIPLIER.get(storage, 1.0)
        * PACKAGING_MULTIPLIER.get(packaging, 1.0)
        * _temp_multiplier(ambient_temp_c, storage)
    )

    now = datetime.now(timezone.utc)
    if prepared_at.tzinfo is None:
        prepared_at = prepared_at.replace(tzinfo=timezone.utc)
    window_end = prepared_at + timedelta(hours=shelf_hours)

    # Confidence: higher for categories with tighter, better-studied windows,
    # and when we actually know the ambient temperature.
    confidence = 0.85 if food_category in ("cooked_meal", "dairy") else 0.7
    if ambient_temp_c is not None:
        confidence = min(0.95, confidence + 0.05)
    if window_end <= now:
        confidence = 0.9  # confidently expired

    return {
        "pickup_window_start": now.isoformat(),
        "pickup_window_end": window_end.isoformat(),
        "shelf_hours": round(shelf_hours, 1),
        "confidence": round(confidence, 2),
    }
