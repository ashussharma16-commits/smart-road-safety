import React, { useState } from "react";
import { api, riskColorHex } from "../api";
import RiskGauge from "./RiskGauge";

export default function RouteComparison({
  pickingMode,
  setPickingMode,
  startPoint,
  endPoint,
  clearPoints,
  routeResult,
  setRouteResult,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canCompare = startPoint && endPoint;

  async function handleCompare() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.routeRisk(startPoint, endPoint);
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

  return (
    <div className="card">
      <h2>Route safety check</h2>
      <div className="route-form">
        <button
          className="ghost"
          style={{ borderColor: pickingMode === "start" ? "#3ddc84" : undefined }}
          onClick={() => setPickingMode("start")}
        >
          {startPoint ? "① Change start" : "① Click map to set start"}
        </button>
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
