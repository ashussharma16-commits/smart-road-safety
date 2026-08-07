import React, { useEffect, useState } from "react";
import { api } from "../api";

const LABELS = {
  historical_accident_count: "Historical accidents nearby",
  traffic_density: "Traffic density",
  visibility_km: "Visibility",
  road_type_residential: "Residential road",
  rain_mm: "Rainfall",
  road_curvature: "Road curvature",
  road_type_intersection: "Intersection",
  temperature_c: "Temperature",
  road_width: "Road width",
  hour: "Hour of day",
};

export default function ModelInsights() {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.modelInfo().then((r) => setInfo(r.data)).catch(() => {});
  }, []);

  if (!info) return null;

  const maxImportance = info.top_features[0]?.importance || 1;

  return (
    <div className="card">
      <h2 onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
        Model insights
        <span style={{ color: "var(--text-faint)" }}>{open ? "−" : "+"}</span>
      </h2>
      <div className="stat-grid">
        <div className="stat">
          <div className="value" style={{ color: "var(--risk-1)" }}>{(info.r2_score * 100).toFixed(1)}%</div>
          <div className="label">R² accuracy</div>
        </div>
        <div className="stat">
          <div className="value">±{info.mae}</div>
          <div className="label">MAE (risk pts)</div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <p className="hint" style={{ marginBottom: 8 }}>
            RandomForestRegressor trained on {info.n_train?.toLocaleString()} rows, tested on{" "}
            {info.n_test?.toLocaleString()}. Top drivers of predicted risk:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {info.top_features.map((f) => (
              <div key={f.feature} className="feature-bar-row">
                <span className="feature-bar-label">{LABELS[f.feature] || f.feature}</span>
                <div className="feature-bar-track">
                  <div
                    className="feature-bar-fill"
                    style={{ width: `${(f.importance / maxImportance) * 100}%` }}
                  />
                </div>
                <span className="feature-bar-pct">{(f.importance * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
