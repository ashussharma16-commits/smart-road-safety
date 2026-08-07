import React, { useState } from "react";
import { api, riskColorHex } from "../api";
import RiskGauge from "./RiskGauge";

// Preset start/end pairs so the demo never depends on clicking the map
// precisely on stage. Swap these for landmarks in your own city if you
// changed BBOX in generate_data.py.
const PRESET_ROUTES = [
  { label: "Connaught Place → Airport", start: [28.6315, 77.2167], end: [28.5562, 77.1000] },
  { label: "Dwarka → Noida", start: [28.5921, 77.0460], end: [28.5355, 77.3910] },
  { label: "Rohini → Gurugram", start: [28.7041, 77.1025], end: [28.4595, 77.0266] },
];

export default function RouteComparison({
  pickingMode,
  setPickingMode,
  startPoint,
  endPoint,
  setStartPoint,
  setEndPoint,
  clearPoints,
  routeResult,
  setRouteResult,
  useMyLocation,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canCompare = startPoint && endPoint;

  async function runCompare(start, end) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.routeRisk(start, end);
      setRouteResult(res.data);
    } catch (e) {
      setError(
        e.response?.data?.detail ||
          "Couldn't fetch a route. The public OSRM routing server may be rate-limited — try again in a few seconds."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCompare() {
    return runCompare(startPoint, endPoint);
  }

  function usePreset(preset) {
    setPickingMode(null);
    setStartPoint(preset.start);
    setEndPoint(preset.end);
    runCompare(preset.start, preset.end);
  }

  return (
    <div className="card">
      <h2>Route safety check</h2>
      <div className="route-form">
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="ghost"
            style={{ borderColor: pickingMode === "start" ? "#3ddc84" : undefined, flex: 1 }}
            onClick={() => setPickingMode("start")}
          >
            {startPoint ? "① Change start" : "① Click map to set start"}
          </button>
          {useMyLocation && (
            <button className="ghost" onClick={useMyLocation} title="Use my current location as start">
              📍
            </button>
          )}
        </div>
        <div className="point-picker">
          <span className="dot" style={{ background: "#3ddc84" }} />
          Start
          <span className="coords">
            {startPoint ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}` : "—"}
          </span>
        </div>

        <button
          className="ghost"
          style={{ borderColor: pickingMode === "end" ? "#e5484d" : undefined }}
          onClick={() => setPickingMode("end")}
        >
          {endPoint ? "② Change destination" : "② Click map to set destination"}
        </button>
        <div className="point-picker">
          <span className="dot" style={{ background: "#e5484d" }} />
          Destination
          <span className="coords">
            {endPoint ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}` : "—"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" disabled={!canCompare || loading} onClick={handleCompare} style={{ flex: 1 }}>
            {loading ? "Scoring routes…" : "Compare route risk"}
          </button>
          <button className="ghost" onClick={clearPoints}>Clear</button>
        </div>

        <p className="hint">
          Click "① Click map to set start", tap a spot on the map, then do the same for the
          destination — mirrors the Road A vs Road B example from the project brief.
        </p>

        <div className="preset-routes">
          {PRESET_ROUTES.map((p) => (
            <button key={p.label} className="ghost preset" disabled={loading} onClick={() => usePreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        {routeResult?.is_estimated && (
          <div className="error-banner" style={{ color: "#ffe28a", borderColor: "var(--risk-3)", background: "rgba(245,197,24,0.1)" }}>
            {routeResult.note}
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}
      </div>

      {routeResult && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {routeResult.routes.map((r) => (
            <div
              key={r.route_index}
              className={
                "route-result" + (r.route_index === routeResult.recommended_route_index ? " recommended" : "")
              }
            >
              {r.route_index === routeResult.recommended_route_index && (
                <span className="badge-recommend">RECOMMENDED</span>
              )}
              <div className="row">
                <b>{r.label}</b>
                <span style={{ fontFamily: "var(--font-mono)", color: riskColorHex(r.risk_score) }}>
                  {r.risk_score} · {r.risk_level}
                </span>
              </div>
              <div className="row" style={{ color: "var(--text-muted)" }}>
                <span>{r.distance_km} km · {r.duration_min} min</span>
                <span>peak {r.max_point_risk}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
            <RiskGauge
              score={routeResult.routes[routeResult.recommended_route_index]?.risk_score || 0}
              label="Recommended route risk"
            />
          </div>
        </div>
      )}
    </div>
  );
}
