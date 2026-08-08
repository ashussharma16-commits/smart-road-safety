from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    timestamp: Optional[datetime] = Field(
        default=None, description="Defaults to server current time if omitted"
    )

    # "What-if" scenario overrides - the underlying model already supports
    # weather_override / traffic_override (see risk_model.py), this just
    # exposes that capability over the API for a live what-if simulator
    # instead of only ever scoring real-time conditions.
    simulate_hour: Optional[int] = Field(default=None, ge=0, le=23)
    simulate_rain_mm: Optional[float] = Field(default=None, ge=0, le=200)
    simulate_fog: Optional[bool] = None
    simulate_traffic_density: Optional[float] = Field(default=None, ge=0, le=1)


class RouteRequest(BaseModel):
    start_lat: float = Field(..., ge=-90, le=90)
    start_lon: float = Field(..., ge=-180, le=180)
    end_lat: float = Field(..., ge=-90, le=90)
    end_lon: float = Field(..., ge=-180, le=180)
    timestamp: Optional[datetime] = None
