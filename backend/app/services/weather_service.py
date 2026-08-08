"""
weather_service.py
-------------------
"Module 2: Weather Analysis" from the project doc.

Uses Open-Meteo (https://open-meteo.com) because it needs NO API key and NO
signup, which matters a lot when you have 10 days. If you later get an
OpenWeatherMap / WeatherAPI key, swap the implementation of `get_weather()`
below - the return shape is what the rest of the app depends on, not this
specific provider.
"""

import logging
import time

import requests

logger = logging.getLogger("roadsense.weather")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT = 10  # was 4 then 8 - Render free-tier cold starts can be slow
RETRIES = 2

# Some hosts / WAFs quietly rate-limit or block the default "python-requests"
# user agent from cloud IPs (Render, Railway, etc). Open-Meteo doesn't
# require this, but identifying the client is good practice and cheap
# insurance against being silently dropped.
HEADERS = {"User-Agent": "RoadSense-Hackathon-Project/1.0 (student project, contact via GitHub)"}

# WMO weather codes (used by Open-Meteo) that mean fog / reduced visibility
FOG_CODES = {45, 48}
RAIN_CODES = set(range(51, 68)) | set(range(80, 83)) | set(range(95, 100))

DEFAULT_WEATHER = {
    "temperature_c": 25.0,
    "rain_mm": 0.0,
    "visibility_km": 8.0,
    "fog": False,
    "humidity": 50,
    "source": "default (offline fallback)",
}


def get_weather(lat: float, lon: float) -> dict:
    """Returns a dict matching the feature schema used by the ML model:
    temperature_c, rain_mm, visibility_km, fog, humidity, source.
    Falls back to sane defaults if the API is unreachable, so a flaky
    hotel/venue wifi during the demo never breaks the app. Retries once
    and logs the real exception (check Render logs) instead of silently
    swallowing it, so a persistent failure is diagnosable.
    """
    last_error = None
    for attempt in range(RETRIES + 1):
        try:
            resp = requests.get(
                OPEN_METEO_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,precipitation,relative_humidity_2m,weather_code",
                    "timezone": "auto",
                },
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            current = resp.json()["current"]

            weather_code = current.get("weather_code", 0)
            rain_mm = float(current.get("precipitation", 0.0) or 0.0)
            fog = weather_code in FOG_CODES
            is_rainy = weather_code in RAIN_CODES or rain_mm > 0

            if fog:
                visibility_km = 0.6
            elif is_rainy and rain_mm > 5:
                visibility_km = 3.0
            elif is_rainy:
                visibility_km = 5.0
            else:
                visibility_km = 9.0

            return {
                "temperature_c": float(current.get("temperature_2m", 25.0)),
                "rain_mm": rain_mm,
                "visibility_km": visibility_km,
                "fog": bool(fog),
                "humidity": current.get("relative_humidity_2m", 50),
                "source": "open-meteo",
            }
        except Exception as e:
            last_error = e
            if attempt < RETRIES:
                time.sleep(0.5)

    logger.warning("Open-Meteo unreachable after retries, using fallback weather: %s", last_error)
    fallback = dict(DEFAULT_WEATHER)
    fallback["error"] = str(last_error)
    return fallback
