import React from "react";
import { riskColorHex } from "../api";
import RiskGauge from "./RiskGauge";

export default function PointCheck({ pickingMode, setPickingMode, point, result, loading, error, onClear }) {
  const active = pickingMode === "predict";

  return (
    <div className="card">
      <h2>Check risk at a point</h2>
      <div className="route-form">
        <button
          className="ghost"
          style={{ borderColor: active ? "#ffc93c" : undefined }}
          onClick={() => setPickingMode(active ? null : "predict")}
        >
          {active ? "Click anywhere on the map…" : point ? "Change point" : "Click map to check a spot"}
        </button>
        {point && (
          <div className="point-picker">
            <span className="dot" style={{ background: "#ffc93c" }} />
            Point
            <span className="coords">{point[0].toFixed(4)}, {point[1].toFixed(4)}</span>
          </div>
        )}
        {point && (
          <button className="ghost" onClick={onClear}>Clear</button>
        )}
        <p className="hint">
          Instant risk score for any spot on the map (weather + traffic + time
          of day + road history) — not tied to a known hotspot.
        </p>
        {error && <div className="error-banner">{error}</div>}
      </div>

      {loading && <div className="loading-line" style={{ marginTop: 10 }}>Scoring…</div>}

      {result && !loading && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RiskGauge score={result.risk_score} label={result.risk_level} />
          </div>
          <div className="route-result">
            <div className="row">
              <b>Top factors</b>
            </div>
            <div className="row" style={{ color: "var(--text-muted)", flexWrap: "wrap" }}>
              {result.top_factors.join(" · ")}
            </div>
            <div className="row" style={{ color: "var(--text-muted)" }}>
              <span>
                {result.weather.temperature_c}°C
                {result.weather.fog ? " · fog" : result.weather.rain_mm > 0 ? ` · ${result.weather.rain_mm}mm rain` : ""}
              </span>
              <span style={{ color: riskColorHex(result.risk_score) }}>traffic {Math.round(result.traffic_density * 100)}%</span>
            </div>
            <div className="row" style={{ color: "var(--text-faint)", fontSize: 11 }}>
              nearest known location {result.nearest_known_location_km} km away
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
