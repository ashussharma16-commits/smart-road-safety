"""
route_service.py
-----------------
"Module 5: Route Risk Scoring" from the project doc - this is the
"Road A vs Road B" motivation example, implemented for real.

Uses the free public OSRM demo server (https://router.project-osrm.org) for
turn-by-turn driving routes - no API key needed. For a production system you
would self-host OSRM or use Google/HERE Directions; see README.

For each candidate route, we sample points evenly along the path and score
each with the trained risk model (using one shared weather/traffic reading
for the whole route, since both are effectively uniform across a city-scale
trip), then aggregate into a single route risk score.
"""

from datetime import datetime

import numpy as np
import requests

from app.ml.risk_model import get_model, risk_level
from app.services.weather_service import get_weather
from app.services.traffic_service import get_traffic_density

OSRM_URL = "http://router.project-osrm.org/route/v1/driving/{coords}"
SAMPLE_POINTS = 12


def _sample_geometry(coordinates: list, n: int) -> list:
    """coordinates: list of [lon, lat]. Returns n evenly spaced [lat, lon]."""
    if len(coordinates) <= n:
        idxs = range(len(coordinates))
    else:
        idxs = np.linspace(0, len(coordinates) - 1, n).astype(int)
    return [[coordinates[i][1], coordinates[i][0]] for i in idxs]


def _fetch_routes(start: tuple, end: tuple) -> list:
    coords = f"{start[1]},{start[0]};{end[1]},{end[0]}"  # OSRM wants lon,lat
    url = OSRM_URL.format(coords=coords)
    resp = requests.get(
        url,
        params={"alternatives": "true", "overview": "full", "geometries": "geojson"},
        timeout=8,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("code") != "Ok":
        raise ValueError(f"OSRM error: {data.get('code')}")
    return data["routes"]


def compare_routes(start: tuple, end: tuple, dt: datetime = None) -> dict:
    """start/end are (lat, lon) tuples. Returns up to 2 scored routes plus a
    recommendation, mirroring the doc's Road A / Road B example.
    """
    dt = dt or datetime.now()
    model = get_model()

    routes = _fetch_routes(start, end)[:2]

    # one shared weather + traffic reading for the whole trip
    mid_lat = (start[0] + end[0]) / 2
    mid_lon = (start[1] + end[1]) / 2
    weather = get_weather(mid_lat, mid_lon)
    traffic_density = get_traffic_density(dt.hour, dt.weekday() >= 5)

    scored_routes = []
    for i, route in enumerate(routes):
        sampled = _sample_geometry(route["geometry"]["coordinates"], SAMPLE_POINTS)
        point_scores = []
        for lat, lon in sampled:
            result = model.predict(
                lat, lon, dt=dt, weather_override=weather, traffic_override=traffic_density
            )
            point_scores.append(result)

        scores = [p["risk_score"] for p in point_scores]
        route_score = float(np.mean(scores))
        scored_routes.append({
            "route_index": i,
            "label": "Primary route" if i == 0 else f"Alternative {i}",
            "distance_km": round(route["distance"] / 1000, 1),
            "duration_min": round(route["duration"] / 60, 1),
            "risk_score": round(route_score, 1),
            "risk_level": risk_level(route_score),
            "max_point_risk": round(max(scores), 1),
            "geometry": [[c[1], c[0]] for c in route["geometry"]["coordinates"]],  # [lat, lon] for Leaflet
            "sampled_points": point_scores,
        })

    scored_routes.sort(key=lambda r: r["risk_score"])
    recommended = scored_routes[0]["route_index"] if scored_routes else None

    return {
        "routes": scored_routes,
        "recommended_route_index": recommended,
        "weather": weather,
        "traffic_density": round(traffic_density, 2),
    }
