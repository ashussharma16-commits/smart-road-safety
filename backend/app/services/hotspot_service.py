"""
hotspot_service.py
-------------------
"Module 4: Accident Hotspot Prediction" from the project doc.

Rather than re-clustering on every request, this precomputes one row per
known location (lat/lon are already stable per location_id in the synthetic
data) with its average historical risk score and accident count, sorted
worst-first for the map + dashboard.
"""

from pathlib import Path
import pandas as pd

DATA_PATH = Path(__file__).parent.parent / "data" / "accidents.csv"

_cache = None


def _load():
    global _cache
    if _cache is None:
        df = pd.read_csv(DATA_PATH)
        grouped = (
            df.groupby(["location_id", "lat", "lon", "road_type", "is_hotspot"])
            .agg(
                avg_risk_score=("risk_score", "mean"),
                max_risk_score=("risk_score", "max"),
                accident_count=("historical_accident_count", "max"),
                accident_rate=("accident_occurred", "mean"),
            )
            .reset_index()
        )
        grouped = grouped.sort_values("avg_risk_score", ascending=False)
        _cache = grouped
    return _cache


def get_hotspots(limit: int = 100, min_risk: float = 0.0) -> list[dict]:
    df = _load()
    df = df[df["avg_risk_score"] >= min_risk].head(limit)
    return df.round(1).to_dict(orient="records")


def get_hourly_risk_profile() -> list[dict]:
    """Average risk by hour of day, for the 'risk by time of day' chart."""
    df = pd.read_csv(DATA_PATH)
    hourly = df.groupby("hour")["risk_score"].mean().round(1).reset_index()
    return hourly.to_dict(orient="records")


def get_summary() -> dict:
    df = _load()
    return {
        "total_locations": int(len(df)),
        "hotspot_count": int(df["is_hotspot"].sum()),
        "avg_risk_score": round(float(df["avg_risk_score"].mean()), 1),
        "high_risk_count": int((df["avg_risk_score"] > 60).sum()),
    }
