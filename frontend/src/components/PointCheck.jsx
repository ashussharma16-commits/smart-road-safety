import React, { useState } from "react";
import { riskColorHex } from "../api";
import RiskGauge from "./RiskGauge";

export default function PointCheck({ pickingMode, setPickingMode, point, result, loading, error, onClear, onSimulate }) {
  const active = pickingMode === "predict";
  const [simOpen, setSimOpen] = useState(false);
  const [hour, setHour] = useState(new Date().getHours());
  const [rain, setRain] = useState(0);
  const [fog, setFog] = useState(false);
  const [traffic, setTraffic] = useState(0.5);

  function apply() {
    onSimulate({
      simulate_hour: hour,
      simulate_rain_mm: rain,
      simulate_fog: fog,
      simulate_traffic_density: traffic,
    });
  }

  function resetToLive() {
    setHour(new Date().getHours());
    setRain(0);
    setFog(false);
    setTraffic(0.5);
    onSimulate({});
  }

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
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
            <RiskGauge score={result.risk_score} label={result.risk_level} />
            {result.is_simulated && <span className="sim-badge">WHAT-IF</span>}
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

          {onSimulate && (
            <div className="what-if">
              <button className="ghost" style={{ width: "100%" }} onClick={() => setSimOpen((o) => !o)}>
                {simOpen ? "Hide what-if simulator ▲" : "What if conditions were different? ▼"}
              </button>
              {simOpen && (
                <div className="what-if-panel">
                  <label className="slider-row">
                    <span>Hour: {hour}:00</span>
                    <input type="range" min="0" max="23" value={hour} onChange={(e) => setHour(+e.target.value)} />
                  </label>
                  <label className="slider-row">
                    <span>Rain: {rain}mm</span>
                    <input type="range" min="0" max="40" value={rain} onChange={(e) => setRain(+e.target.value)} />
                  </label>
                  <label className="slider-row">
                    <span>Traffic: {Math.round(traffic * 100)}%</span>
                    <input type="range" min="0" max="1" step="0.05" value={traffic} onChange={(e) => setTraffic(+e.target.value)} />
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={fog} onChange={(e) => setFog(e.target.checked)} />
                    <span>Fog</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="primary" style={{ flex: 1 }} onClick={apply}>Run scenario</button>
                    <button className="ghost" onClick={resetToLive}>Reset to live</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
