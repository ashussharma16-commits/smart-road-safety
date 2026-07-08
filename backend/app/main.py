"""
main.py
-------
FastAPI entrypoint. This is the "Dashboard / Web Application" layer sitting
on top of the Prediction Engine + Risk Score Generator in the architecture
diagram.

Run from the backend/ folder:
    uvicorn app.main:app --reload --port 8000

Then open http://localhost:8000/docs for interactive Swagger docs -- great
for a live demo if the frontend has an issue on stage.
"""

from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.ml.risk_model import get_model
from app.schemas import PredictRequest, RouteRequest
from app.services import hotspot_service, route_service, weather_service

app = FastAPI(
    title="Smart Road Safety & Accident Prediction API",
    description="Spatio-temporal accident risk prediction, hotspot mapping, and route safety scoring.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this before any real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warm_up():
    # loads the model + location lookup table once, instead of on first request
    get_model()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/predict")
def predict(req: PredictRequest):
    model = get_model()
    try:
        return model.predict(req.lat, req.lon, dt=req.timestamp or datetime.now())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/hotspots")
def hotspots(limit: int = 100, min_risk: float = 0.0):
    return hotspot_service.get_hotspots(limit=limit, min_risk=min_risk)


@app.get("/api/summary")
def summary():
    return hotspot_service.get_summary()


@app.get("/api/analytics/hourly-risk")
def hourly_risk():
    return hotspot_service.get_hourly_risk_profile()


@app.get("/api/weather")
def weather(lat: float, lon: float):
    return weather_service.get_weather(lat, lon)


@app.post("/api/route-risk")
def route_risk(req: RouteRequest):
    try:
        return route_service.compare_routes(
            (req.start_lat, req.start_lon),
            (req.end_lat, req.end_lon),
            dt=req.timestamp or datetime.now(),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Routing failed: {e}")
