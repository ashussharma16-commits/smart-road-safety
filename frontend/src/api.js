import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
});

export const api = {
  health: () => client.get("/api/health"),
  summary: () => client.get("/api/summary"),
  hotspots: (limit = 100) => client.get(`/api/hotspots?limit=${limit}`),
  hourlyRisk: () => client.get("/api/analytics/hourly-risk"),
  predict: (lat, lon) => client.post("/api/predict", { lat, lon }),
  routeRisk: (start, end) =>
    client.post("/api/route-risk", {
      start_lat: start[0],
      start_lon: start[1],
      end_lat: end[0],
      end_lon: end[1],
    }),
};

// risk score (0-100) -> band color, matches backend RISK_BANDS
export function riskColor(score) {
  if (score <= 20) return "var(--risk-1)";
  if (score <= 40) return "var(--risk-2)";
  if (score <= 60) return "var(--risk-3)";
  if (score <= 80) return "var(--risk-4)";
  return "var(--risk-5)";
}

export function riskColorHex(score) {
  if (score <= 20) return "#3ddc84";
  if (score <= 40) return "#a3d24d";
  if (score <= 60) return "#f5c518";
  if (score <= 80) return "#f2872e";
  return "#e5484d";
}
