from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    lat: float
    lon: float
    timestamp: Optional[datetime] = Field(
        default=None, description="Defaults to server current time if omitted"
    )


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    timestamp: Optional[datetime] = None
