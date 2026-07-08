import React from "react";
import { riskColorHex } from "../api";

const BANDS = [
  { from: 0, to: 20, color: "#3ddc84" },
  { from: 20, to: 40, color: "#a3d24d" },
  { from: 40, to: 60, color: "#f5c518" },
  { from: 60, to: 80, color: "#f2872e" },
  { from: 80, to: 100, color: "#e5484d" },
];

const CX = 60;
const CY = 58;
const R = 46;

function polar(score) {
  // score 0-100 maps to angle 180deg (left) -> 0deg (right)
  const angle = 180 - (score / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}

function arcPath(fromScore, toScore, radius) {
  const p1 = polar(fromScore);
  const p2 = polar(toScore);
  const p1r = { x: CX + radius * Math.cos((180 - (fromScore / 100) * 180) * Math.PI / 180), y: CY - radius * Math.sin((180 - (fromScore / 100) * 180) * Math.PI / 180) };
  const p2r = { x: CX + radius * Math.cos((180 - (toScore / 100) * 180) * Math.PI / 180), y: CY - radius * Math.sin((180 - (toScore / 100) * 180) * Math.PI / 180) };
  const largeArc = toScore - fromScore > 50 ? 1 : 0;
  return `M ${p1r.x} ${p1r.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2r.x} ${p2r.y}`;
}

export default function RiskGauge({ score = 0, label = "", size = 140 }) {
  const needle = polar(score);
  const activeColor = riskColorHex(score);

  return (
    <div className="gauge-wrap">
      <svg width={size} height={size * 0.62} viewBox="0 0 120 70">
        {BANDS.map((b) => (
          <path
            key={b.from}
            d={arcPath(b.from, b.to, R)}
            fill="none"
            stroke={b.color}
            strokeWidth={9}
            strokeLinecap="butt"
            opacity={score >= b.from ? 1 : 0.25}
          />
        ))}
        {/* needle */}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          stroke="#e9ebef"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={4} fill="#e9ebef" />
      </svg>
      <div className="gauge-score" style={{ color: activeColor }}>
        {Math.round(score)}
      </div>
      {label && <div className="gauge-caption">{label}</div>}
    </div>
  );
}
