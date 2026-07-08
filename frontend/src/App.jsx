import React, { useEffect, useState } from "react";
import MapView from "./components/MapView";
import Dashboard from "./components/Dashboard";
import RouteComparison from "./components/RouteComparison";
import { api } from "./api";

export default function App() {
  const [summary, setSummary] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [hotspots, setHotspots] = useState([]);

  const [pickingMode, setPickingMode] = useState(null); // "start" | "end" | null
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeResult, setRouteResult] = useState(null);

  useEffect(() => {
    api.summary().then((r) => setSummary(r.data)).catch(() => {});
    api.hourlyRisk().then((r) => setHourly(r.data)).catch(() => {});
    api.hotspots(150).then((r) => setHotspots(r.data)).catch(() => {});
  }, []);

  function handleMapClick(latlng) {
    if (pickingMode === "start") {
      setStartPoint(latlng);
      setPickingMode(null);
    } else if (pickingMode === "end") {
      setEndPoint(latlng);
      setPickingMode(null);
    }
  }

  function clearPoints() {
    setStartPoint(null);
    setEndPoint(null);
    setRouteResult(null);
    setPickingMode(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="mark" />
        <h1>RoadSense</h1>
        <span className="tagline">AI-based road safety & accident risk prediction</span>
        <div className="legend">
          <span className="legend-dot" style={{ "--dot": "#3ddc84" }}>Safe</span>
          <span className="legend-dot" style={{ "--dot": "#f5c518" }}>Moderate</span>
          <span className="legend-dot" style={{ "--dot": "#e5484d" }}>Danger</span>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <Dashboard summary={summary} hourly={hourly} hotspots={hotspots} />
          <RouteComparison
            pickingMode={pickingMode}
            setPickingMode={setPickingMode}
            startPoint={startPoint}
            endPoint={endPoint}
            clearPoints={clearPoints}
            routeResult={routeResult}
            setRouteResult={setRouteResult}
          />
        </aside>
        <main className="map-area">
          <MapView
            hotspots={hotspots}
            startPoint={startPoint}
            endPoint={endPoint}
            routeResult={routeResult}
            onMapClick={handleMapClick}
          />
        </main>
      </div>
    </div>
  );
}
