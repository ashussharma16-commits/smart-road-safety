import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { riskColorHex } from "../api";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#20252e",
        border: "1px solid #2a303c",
        borderRadius: 6,
        padding: "6px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      {label}:00 — risk {payload[0].value}
    </div>
  );
}

export default function Dashboard({ summary, hourly, hotspots }) {
  return (
    <>
      <div className="card">
        <h2>Region overview</h2>
        {summary ? (
          <div className="stat-grid">
            <div className="stat">
              <div className="value">{summary.total_locations}</div>
              <div className="label">Tracked locations</div>
            </div>
            <div className="stat">
              <div className="value" style={{ color: "#e5484d" }}>{summary.hotspot_count}</div>
              <div className="label">Known hotspots</div>
            </div>
            <div className="stat">
              <div className="value">{summary.avg_risk_score}</div>
              <div className="label">Avg. risk score</div>
            </div>
            <div className="stat">
              <div className="value" style={{ color: "#f2872e" }}>{summary.high_risk_count}</div>
              <div className="label">High-risk zones</div>
            </div>
          </div>
        ) : (
          <div className="loading-line">Loading summary…</div>
        )}
      </div>

      <div className="card">
        <h2>Risk by hour of day</h2>
        {hourly.length > 0 ? (
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourly} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#2a303c" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#8b93a3", fontSize: 10 }}
                  interval={3}
                  axisLine={{ stroke: "#2a303c" }}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "#8b93a3", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="risk_score"
                  stroke="#ffc93c"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="loading-line">Loading…</div>
        )}
        <p className="hint">Rush-hour peaks (~8-10am, 5-8pm) show up as higher average risk — matches Module 3 in the brief.</p>
      </div>

      <div className="card">
        <h2>Top risk locations</h2>
        <div className="hotspot-list">
          {hotspots.slice(0, 12).map((h) => (
            <div key={h.location_id} className="hotspot-row">
              <span className="swatch" style={{ background: riskColorHex(h.avg_risk_score) }} />
              <span className="id">{h.location_id}</span>
              <span style={{ color: "var(--text-muted)" }}>{h.road_type}</span>
              <span className="score" style={{ color: riskColorHex(h.avg_risk_score) }}>
                {h.avg_risk_score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
