"""
generate_data.py
-----------------
Builds a synthetic-but-realistic accident/risk dataset so the ML pipeline and
API have something to train and demo on immediately.

WHY SYNTHETIC DATA:
Real accident datasets (data.gov.in, MoRTH "Road Accidents in India" reports,
Kaggle "US Accidents") exist but are heavy to clean inside a 10-day hackathon
window. This script creates a dataset with the *same column schema* you would
get from a real source, so swapping in real data later is a drop-in
replacement -- see README section "Swapping in real data".

Region used: Delhi-NCR bounding box (lat 28.40-28.80, lon 76.85-77.35).
Change BBOX below to any city.
"""

import numpy as np
import pandas as pd
from pathlib import Path

RNG = np.random.default_rng(42)

BBOX = {"lat_min": 28.40, "lat_max": 28.80, "lon_min": 76.85, "lon_max": 77.35}

ROAD_TYPES = ["highway", "arterial", "intersection", "residential"]
ROAD_TYPE_BASE_RISK = {"highway": 0.35, "arterial": 0.5, "intersection": 0.65, "residential": 0.2}

N_HOTSPOTS = 40          # known dangerous junctions/stretches
N_NORMAL_LOCATIONS = 260  # ordinary road segments
YEARS = 5
ROWS_PER_LOCATION_PER_YEAR = 20  # sampled hourly "observations", not literal accidents


def _rand_point():
    lat = RNG.uniform(BBOX["lat_min"], BBOX["lat_max"])
    lon = RNG.uniform(BBOX["lon_min"], BBOX["lon_max"])
    return lat, lon


def _make_locations():
    """Create a fixed set of locations, some deliberately risky (hotspots)."""
    locations = []
    for i in range(N_HOTSPOTS):
        lat, lon = _rand_point()
        locations.append({
            "location_id": f"HS{i:03d}",
            "lat": lat, "lon": lon,
            "road_type": RNG.choice(["intersection", "arterial", "highway"], p=[0.55, 0.30, 0.15]),
            "is_hotspot": True,
            "nearby_school": RNG.random() < 0.4,
            "nearby_hospital": RNG.random() < 0.25,
            "road_curvature": RNG.uniform(0.4, 1.0),
            "road_width": RNG.uniform(6, 12),
            "speed_limit": int(RNG.choice([40, 50, 60, 80])),
        })
    for i in range(N_NORMAL_LOCATIONS):
        lat, lon = _rand_point()
        rt = RNG.choice(ROAD_TYPES, p=[0.2, 0.3, 0.15, 0.35])
        locations.append({
            "location_id": f"RD{i:04d}",
            "lat": lat, "lon": lon,
            "road_type": rt,
            "is_hotspot": False,
            "nearby_school": RNG.random() < 0.15,
            "nearby_hospital": RNG.random() < 0.1,
            "road_curvature": RNG.uniform(0.0, 0.6),
            "road_width": RNG.uniform(4, 14),
            "speed_limit": int(RNG.choice([30, 40, 50, 60, 80], p=[0.25, 0.3, 0.25, 0.15, 0.05])),
        })
    return pd.DataFrame(locations)


def _weather_for(month, hour):
    """Very rough Delhi seasonal weather model: monsoon Jul-Sep, fog Dec-Jan nights."""
    is_monsoon = month in (7, 8, 9)
    is_winter = month in (12, 1)
    rain_prob = 0.35 if is_monsoon else 0.05
    rain_mm = RNG.exponential(8) if RNG.random() < rain_prob else 0.0
    fog = is_winter and hour in (0, 1, 2, 3, 4, 5, 6, 22, 23) and RNG.random() < 0.5
    visibility_km = RNG.uniform(0.2, 1.5) if fog else (RNG.uniform(2, 5) if rain_mm > 5 else RNG.uniform(6, 10))
    temp = RNG.uniform(6, 20) if is_winter else (RNG.uniform(28, 42) if month in (4, 5, 6) else RNG.uniform(18, 32))
    return rain_mm, visibility_km, fog, temp


def _traffic_density(hour, is_weekend):
    peak = hour in (8, 9, 10, 17, 18, 19, 20)
    base = 0.25 if is_weekend else 0.35
    if peak and not is_weekend:
        return float(np.clip(RNG.normal(0.8, 0.1), 0, 1))
    if peak and is_weekend:
        return float(np.clip(RNG.normal(0.55, 0.15), 0, 1))
    return float(np.clip(RNG.normal(base, 0.15), 0, 1))


def _risk_score(row):
    """Ground-truth generator loosely following the doc's weighted formula
    (0.4 history + 0.3 weather + 0.2 traffic + 0.1 road condition), with
    non-linear interaction terms so a tree model has something real to learn.
    """
    hist_component = np.clip(row["historical_accident_count"] / 40, 0, 1)

    weather_component = 0.0
    weather_component += np.clip(row["rain_mm"] / 30, 0, 1) * 0.6
    weather_component += (1 - np.clip(row["visibility_km"] / 10, 0, 1)) * 0.4
    if row["fog"]:
        weather_component = min(1.0, weather_component + 0.25)

    traffic_component = row["traffic_density"]

    road_component = ROAD_TYPE_BASE_RISK[row["road_type"]]
    road_component += row["road_curvature"] * 0.2
    road_component += (row["speed_limit"] / 80) * 0.15
    road_component = np.clip(road_component, 0, 1)

    score = (
        0.40 * hist_component
        + 0.30 * weather_component
        + 0.20 * traffic_component
        + 0.10 * road_component
    ) * 100

    # interaction: bad weather at a known hotspot is worse than the sum of parts
    if row["is_hotspot"] and weather_component > 0.5:
        score += 8
    if row["nearby_school"] and 7 <= row["hour"] <= 9:
        score += 5

    score += RNG.normal(0, 4)  # noise
    return float(np.clip(score, 0, 100))


def generate(output_path: str = None) -> pd.DataFrame:
    locations = _make_locations()
    rows = []

    for _, loc in locations.iterrows():
        # simulate a hotspot's accident history *growing* year over year,
        # mirroring the doc's Road-X example (20 -> 25 -> 30 -> 28 -> 35)
        yearly_counts = []
        base = RNG.integers(15, 30) if loc["is_hotspot"] else RNG.integers(0, 6)
        count = base
        for _ in range(YEARS):
            count = max(0, count + RNG.integers(-3, 6) + (2 if loc["is_hotspot"] else 0))
            yearly_counts.append(count)

        for year_idx, year in enumerate(range(2019, 2019 + YEARS)):
            running_hist = sum(yearly_counts[:year_idx]) if year_idx > 0 else yearly_counts[0] // 2
            for _ in range(ROWS_PER_LOCATION_PER_YEAR):
                month = int(RNG.integers(1, 13))
                day = int(RNG.integers(1, 28))
                hour = int(RNG.integers(0, 24))
                dow = int(RNG.integers(0, 7))  # 0=Mon
                is_weekend = dow >= 5

                rain_mm, visibility_km, fog, temp = _weather_for(month, hour)
                traffic_density = _traffic_density(hour, is_weekend)

                row = {
                    "location_id": loc["location_id"],
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "year": year, "month": month, "day": day, "hour": hour,
                    "day_of_week": dow, "is_weekend": is_weekend,
                    "rain_mm": rain_mm, "visibility_km": visibility_km, "fog": fog,
                    "temperature_c": temp,
                    "traffic_density": traffic_density,
                    "road_type": loc["road_type"],
                    "speed_limit": loc["speed_limit"],
                    "road_curvature": loc["road_curvature"],
                    "road_width": loc["road_width"],
                    "nearby_school": loc["nearby_school"],
                    "nearby_hospital": loc["nearby_hospital"],
                    "is_hotspot": loc["is_hotspot"],
                    "historical_accident_count": running_hist,
                }
                row["risk_score"] = _risk_score(row)
                row["accident_occurred"] = int(row["risk_score"] > (60 + RNG.normal(0, 8)))
                rows.append(row)

    df = pd.DataFrame(rows)
    if output_path:
        df.to_csv(output_path, index=False)
    return df


if __name__ == "__main__":
    out = Path(__file__).parent / "accidents.csv"
    df = generate(str(out))
    print(f"Generated {len(df):,} rows -> {out}")
    print(df[["risk_score", "accident_occurred"]].describe())
