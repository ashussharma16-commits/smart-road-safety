import React from "react";

const REAL_VS_SIM = [
  { module: "ML risk prediction", status: "real", note: "RandomForestRegressor, R² ≈ 0.93" },
  { module: "Weather", status: "real", note: "Live Open-Meteo API, no key needed" },
  { module: "Traffic density", status: "simulated", note: "Rush-hour heuristic (real feeds need billing keys)" },
  { module: "Accident hotspots", status: "real", note: "Aggregated from the trained dataset" },
  { module: "Route risk scoring", status: "real", note: "Live OSRM routing + per-point model scoring" },
  { module: "What-if simulator", status: "real", note: "Same trained model, user-set conditions" },
];

export default function InfoModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>How RoadSense works</h2>
          <button className="ghost" onClick={onClose}>Close ✕</button>
        </div>

        <div className="modal-body">
          <p>
            RoadSense predicts an accident risk score (0–100) for any point on the
            map by combining weather, traffic, time-of-day, and historical accident
            data through a trained ML model — then uses that same model to score
            and compare full routes.
          </p>

          <h3>Pipeline</h3>
          <div className="pipeline">
            <span className="pipeline-step">Weather + traffic + road history</span>
            <span className="pipeline-arrow">→</span>
            <span className="pipeline-step">RandomForest risk model</span>
            <span className="pipeline-arrow">→</span>
            <span className="pipeline-step">Risk score (0–100)</span>
            <span className="pipeline-arrow">→</span>
            <span className="pipeline-step">Map, hotspots, route comparison</span>
          </div>

          <h3>What's real vs simulated</h3>
          <table className="honesty-table">
            <thead>
              <tr><th>Module</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody>
              {REAL_VS_SIM.map((r) => (
                <tr key={r.module}>
                  <td>{r.module}</td>
                  <td>
                    <span className={"status-pill " + r.status}>
                      {r.status === "real" ? "Real" : "Simulated"}
                    </span>
                  </td>
                  <td className="muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="hint" style={{ marginTop: 10 }}>
            Being upfront about this is a stronger pitch than pretending everything
            is live — the ML core, weather, hotspots, and route scoring are genuinely
            real; traffic density is a realistic simulation because live traffic
            feeds need billing-enabled API keys.
          </p>
        </div>
      </div>
    </div>
  );
}
