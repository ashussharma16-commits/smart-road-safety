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

import json
import os
from datetime import datetime
from pathlib import Path

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

# ALLOWED_ORIGINS env var: comma-separated list of allowed frontend origins,
# e.g. "https://your-app.vercel.app,http://localhost:5173". Defaults to "*"
# for local dev / hackathon demo. NOTE: allow_credentials=True + origin "*"
# is rejected by browsers per the CORS spec, so credentials are only enabled
# once you set real origins.
_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
_wildcard = ALLOWED_ORIGINS == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=not _wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warm_up():
    # loads the model + location lookup table once, instead of on first request
    get_model()


@app.get("/")
def root():
    # lets Render/Railway health checks and a bare curl to the base URL
    # return something other than a 404 during demo troubleshooting
    return {"status": "ok", "service": "smart-road-safety-api", "docs": "/docs"}


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


ML_DIR = Path(__file__).parent / "ml"


@app.get("/api/model-info")
def model_info():
    """Model transparency endpoint - trained metrics + top feature drivers.
    Powers the 'Model Insights' panel; also handy to have loaded up for
    judge Q&A ("how does the model actually decide risk?").
    """
    try:
        metrics = json.loads((ML_DIR / "metrics.json").read_text())
        importance = json.loads((ML_DIR / "feature_importance.json").read_text())
        return {
            "model_type": "RandomForestRegressor",
            "r2_score": round(metrics.get("r2", 0), 4),
            "mae": round(metrics.get("mae", 0), 2),
            "n_train": metrics.get("n_train"),
            "n_test": metrics.get("n_test"),
            "top_features": importance[:6],
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Model metrics not found - run training first.")


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
