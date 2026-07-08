"""
traffic_service.py
-------------------
"Module 3: Traffic Density Prediction" from the project doc.

A real traffic feed (Google Roads/TomTom/HERE) needs a billing-enabled API
key, which is overkill for a 10-day hackathon build. This module simulates
traffic density with the same rush-hour pattern real traffic follows, so the
downstream risk model and demo behave realistically. Swap this out for a real
provider later without touching anything else (see README).
"""

from datetime import datetime

MORNING_PEAK = {8, 9, 10}
EVENING_PEAK = {17, 18, 19, 20}


def get_traffic_density(hour: int = None, is_weekend: bool = None) -> float:
    """Returns a 0-1 traffic density estimate for the given hour."""
    now = datetime.now()
    if hour is None:
        hour = now.hour
    if is_weekend is None:
        is_weekend = now.weekday() >= 5

    if hour in MORNING_PEAK or hour in EVENING_PEAK:
        return 0.55 if is_weekend else 0.85
    if 11 <= hour <= 16:
        return 0.45 if is_weekend else 0.55
    if 21 <= hour or hour <= 5:
        return 0.15
    return 0.3
