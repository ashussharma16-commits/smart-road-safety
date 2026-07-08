"""
train_model.py
---------------
Feature-engineers the accident dataset and trains a RandomForestRegressor
that predicts a 0-100 "risk_score" for a given location/time/weather/traffic
combination (this is the "Module: Machine Learning Models" + "Risk Score
Generator" blocks in the architecture diagram).

Run:
    python -m app.ml.train_model
(run from the backend/ folder so the "app" package resolves)

Outputs (into app/ml/):
    risk_model.joblib        - trained sklearn pipeline
    feature_importance.json  - for the dashboard's "why this score" panel
    metrics.json             - train/test metrics so you can quote a number
                               in your hackathon slides
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

HERE = Path(__file__).parent
DATA_PATH = HERE.parent / "data" / "accidents.csv"

NUMERIC_FEATURES = [
    "hour", "day_of_week", "month", "rain_mm", "visibility_km",
    "temperature_c", "traffic_density", "speed_limit", "road_curvature",
    "road_width", "historical_accident_count",
]
BOOLEAN_FEATURES = ["is_weekend", "fog", "nearby_school", "nearby_hospital"]
CATEGORICAL_FEATURES = ["road_type"]
TARGET = "risk_score"

FEATURE_COLUMNS = NUMERIC_FEATURES + BOOLEAN_FEATURES + CATEGORICAL_FEATURES


def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"{DATA_PATH} not found. Run `python app/data/generate_data.py` first "
            "(or point DATA_PATH at your real dataset with the same columns)."
        )
    df = pd.read_csv(DATA_PATH)
    for col in BOOLEAN_FEATURES + ["is_hotspot"]:
        if col in df.columns:
            df[col] = df[col].astype(bool).astype(int)
    return df


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ],
        remainder="passthrough",
    )
    model = RandomForestRegressor(
        n_estimators=120,
        max_depth=11,
        min_samples_leaf=5,
        n_jobs=-1,
        random_state=42,
    )
    return Pipeline([("prep", preprocessor), ("model", model)])


def main():
    df = load_dataset()
    X = df[FEATURE_COLUMNS]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipe = build_pipeline()
    pipe.fit(X_train, y_train)

    preds = pipe.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    print(f"Test MAE: {mae:.2f} risk points | R^2: {r2:.3f}")

    # feature importance (post one-hot, so map back to friendly names)
    ohe = pipe.named_steps["prep"].named_transformers_["cat"]
    cat_names = list(ohe.get_feature_names_out(CATEGORICAL_FEATURES))
    passthrough_names = NUMERIC_FEATURES + BOOLEAN_FEATURES
    all_names = cat_names + passthrough_names
    importances = pipe.named_steps["model"].feature_importances_
    importance_map = sorted(
        zip(all_names, importances), key=lambda kv: kv[1], reverse=True
    )

    joblib.dump(pipe, HERE / "risk_model.joblib", compress=3)
    with open(HERE / "feature_columns.json", "w") as f:
        json.dump({
            "numeric": NUMERIC_FEATURES,
            "boolean": BOOLEAN_FEATURES,
            "categorical": CATEGORICAL_FEATURES,
        }, f, indent=2)
    with open(HERE / "feature_importance.json", "w") as f:
        json.dump([{"feature": n, "importance": float(i)} for n, i in importance_map], f, indent=2)
    with open(HERE / "metrics.json", "w") as f:
        json.dump({"mae": float(mae), "r2": float(r2), "n_train": len(X_train), "n_test": len(X_test)}, f, indent=2)

    print("Saved risk_model.joblib, feature_importance.json, metrics.json")
    print("\nTop 5 risk factors:")
    for name, imp in importance_map[:5]:
        print(f"  {name}: {imp:.3f}")


if __name__ == "__main__":
    main()
