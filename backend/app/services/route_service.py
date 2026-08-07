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

import time
from datetime import datetime

import numpy as np
import requests

from app.ml.risk_model import get_model, risk_level
from app.services.weather_service import get_weather
from app.services.traffic_service import get_traffic_density

OSRM_URL = "https://router.project-osrm.org/route/v1/driving/{coords}"
SAMPLE_POINTS = 12
OSRM_RETRIES = 2
OSRM_TIMEOUT = 6


def _sample_geometry(coordinates: list, n: int) -> list:
    """coordinates: list of [lon, lat]. Returns n evenly spaced [lat, lon]."""
    if len(coordinates) <= n:
        idxs = range(len(coordinates))
    else:
        idxs = np.linspace(0, len(coordinates) - 1, n).astype(int)
    return [[coordinates[i][1], coordinates[i][0]] for i in idxs]


def _straight_line_route(start: tuple, end: tuple) -> dict:
    """Fallback 'route' when OSRM is unreachable (rate-limited / venue wifi
    down) so the demo degrades gracefully instead of showing a hard error.
    Straight-line distance is an underestimate of real driving distance, so
    duration/distance here are rough - the risk scoring along the line is
    still meaningful since it samples real lat/lon points against the model.
    """
    lat1, lon1 = start
    lat2, lon2 = end
    dist_km = float(
        np.hypot((lat2 - lat1) * 111.0, (lon2 - lon1) * 111.0 * np.cos(np.radians((lat1 + lat2) / 2)))
    )
    n = max(SAMPLE_POINTS, 8)
    coords = [
        [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]
        for t in np.linspace(0, 1, n)
    ]
    return {
        "distance": dist_km * 1000,
        "duration": dist_km / 35 * 3600,  # assume ~35km/h average
        "geometry": {"coordinates": coords},
        "_fallback": True,
    }


def _fetch_routes(start: tuple, end: tuple) -> list:
    coords = f"{start[1]},{start[0]};{end[1]},{end[0]}"  # OSRM wants lon,lat
    url = OSRM_URL.format(coords=coords)

    last_error = None
    for attempt in range(OSRM_RETRIES + 1):
        try:
            resp = requests.get(
                url,
                params={"alternatives": "true", "overview": "full", "geometries": "geojson"},
                timeout=OSRM_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != "Ok":
                raise ValueError(f"OSRM error: {data.get('code')}")
            return data["routes"]
        except Exception as e:
            last_error = e
            if attempt < OSRM_RETRIES:
                time.sleep(0.5 * (attempt + 1))  # brief backoff before retry

    # OSRM totally unreachable after retries - fall back to a straight-line
    # "route" so the live demo never just throws an error on stage.
    return [_straight_line_route(start, end)]


def compare_routes(start: tuple, end: tuple, dt: datetime = None) -> dict:
    """start/end are (lat, lon) tuples. Returns up to 2 scored routes plus a
    recommendation, mirroring the doc's Road A / Road B example.
    """
    dt = dt or datetime.now()
    model = get_model()

    routes = _fetch_routes(start, end)[:2]
    is_fallback = bool(routes and routes[0].get("_fallback"))

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
        "is_estimated": is_fallback,
        "note": (
            "Live routing (OSRM) was unreachable, showing an estimated straight-line "
            "path with real risk scoring along it."
        ) if is_fallback else None,
    }
