"""
risk_model.py
-------------
Runtime prediction wrapper. Loads the trained pipeline once at startup and
exposes `predict_risk(lat, lon, dt, weather_override, traffic_override)`
which the API routes call.

Historical accident context: a real system would query a database of past
accidents near (lat, lon). Here we do the same lookup against the generated
accidents.csv using a nearest-neighbour search (haversine distance) -- when
you plug in a real dataset, this keeps working as long as it has lat/lon +
historical_accident_count columns (or you can compute that count yourself
from raw accident records).
"""

from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.services.weather_service import get_weather
from app.services.traffic_service import get_traffic_density

HERE = Path(__file__).parent
MODEL_PATH = HERE / "risk_model.joblib"
DATA_PATH = HERE.parent / "data" / "accidents.csv"

RISK_BANDS = [
    (20, "Very Safe"),
    (40, "Safe"),
    (60, "Moderate"),
    (80, "Danger"),
    (101, "Very Dangerous"),
]


def risk_level(score: float) -> str:
    for threshold, label in RISK_BANDS:
        if score <= threshold:
            return label
    return "Very Dangerous"


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


class RiskModel:
    def __init__(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "risk_model.joblib not found. Run `python -m app.ml.train_model` "
                "from the backend/ folder first."
            )
        self.pipeline = joblib.load(MODEL_PATH)

        # location lookup table: one row per unique location_id with its
        # latest known stats, used to estimate historical_accident_count,
        # road_type etc. for any lat/lon the frontend asks about.
        df = pd.read_csv(DATA_PATH)
        self.locations = (
            df.sort_values("year")
            .groupby("location_id")
            .last()
            .reset_index()[[
                "location_id", "lat", "lon", "road_type", "speed_limit",
                "road_curvature", "road_width", "nearby_school",
                "nearby_hospital", "historical_accident_count", "is_hotspot",
            ]]
        )

    def nearest_location(self, lat: float, lon: float) -> dict:
        dists = _haversine_km(lat, lon, self.locations["lat"].values, self.locations["lon"].values)
        idx = int(np.argmin(dists))
        row = self.locations.iloc[idx].to_dict()
        row["distance_km"] = float(dists[idx])
        return row

    def predict(
        self,
        lat: float,
        lon: float,
        dt: datetime = None,
        weather_override: dict = None,
        traffic_override: float = None,
    ) -> dict:
        dt = dt or datetime.now()
        nearest = self.nearest_location(lat, lon)

        weather = weather_override or get_weather(lat, lon)
        is_weekend = dt.weekday() >= 5
        traffic_density = (
            traffic_override if traffic_override is not None
            else get_traffic_density(dt.hour, is_weekend)
        )

        features = pd.DataFrame([{
            "hour": dt.hour,
            "day_of_week": dt.weekday(),
            "month": dt.month,
            "rain_mm": weather["rain_mm"],
            "visibility_km": weather["visibility_km"],
            "temperature_c": weather["temperature_c"],
            "traffic_density": traffic_density,
            "speed_limit": nearest["speed_limit"],
            "road_curvature": nearest["road_curvature"],
            "road_width": nearest["road_width"],
            "historical_accident_count": nearest["historical_accident_count"],
            "is_weekend": int(is_weekend),
            "fog": int(weather["fog"]),
            "nearby_school": int(nearest["nearby_school"]),
            "nearby_hospital": int(nearest["nearby_hospital"]),
            "road_type": nearest["road_type"],
        }])

        score = float(np.clip(self.pipeline.predict(features)[0], 0, 100))

        top_factors = []
        if weather["fog"]:
            top_factors.append("Fog reducing visibility")
        elif weather["rain_mm"] > 5:
            top_factors.append("Heavy rain")
        if traffic_density > 0.7:
            top_factors.append("Heavy traffic congestion")
        if nearest["historical_accident_count"] > 15:
            top_factors.append("High historical accident count nearby")
        if nearest["is_hotspot"]:
            top_factors.append("Known accident hotspot")
        if not top_factors:
            top_factors.append("Normal conditions")

        return {
            "lat": lat,
            "lon": lon,
            "risk_score": round(score, 1),
            "risk_level": risk_level(score),
            "top_factors": top_factors,
            "weather": weather,
            "traffic_density": round(traffic_density, 2),
            "nearest_known_location_km": round(nearest["distance_km"], 2),
        }


_model_singleton = None


def get_model() -> RiskModel:
    global _model_singleton
    if _model_singleton is None:
        _model_singleton = RiskModel()
    return _model_singleton
