import unittest
from datetime import datetime, timedelta, timezone

from app.rules.spoilage_rules import predict


class SpoilageRulesTests(unittest.TestCase):
    def test_hot_weather_shortens_room_temperature_window(self):
        prepared = datetime.now(timezone.utc)
        mild = predict("cooked_meal", prepared, "room_temp", "covered", 20)
        hot = predict("cooked_meal", prepared, "room_temp", "covered", 35)
        self.assertLess(hot["shelf_hours"], mild["shelf_hours"])

    def test_expired_food_is_reported_with_past_window(self):
        prepared = datetime.now(timezone.utc) - timedelta(days=2)
        result = predict("cooked_meal", prepared, "room_temp", "covered")
        self.assertLessEqual(
            datetime.fromisoformat(result["pickup_window_end"]),
            datetime.now(timezone.utc),
        )
        self.assertEqual(result["confidence"], 0.9)


if __name__ == "__main__":
    unittest.main()
