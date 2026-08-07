import React, { useEffect, useState } from "react";
import MapView from "./components/MapView";
import Dashboard from "./components/Dashboard";
import RouteComparison from "./components/RouteComparison";
import PointCheck from "./components/PointCheck";
import WeatherWidget from "./components/WeatherWidget";
import ModelInsights from "./components/ModelInsights";
import { api } from "./api";

const DELHI_CENTER = [28.6139, 77.209];

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem("roadsense-theme");
  if (saved) return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  const [summary, setSummary] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [pickingMode, setPickingMode] = useState(null); // "start" | "end" | "predict" | null
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeResult, setRouteResult] = useState(null);

  const [pointCheck, setPointCheck] = useState(null); // {lat, lon}
  const [pointResult, setPointResult] = useState(null);
  const [pointLoading, setPointLoading] = useState(false);
  const [pointError, setPointError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("roadsense-theme", theme);
  }, [theme]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  function loadDashboardData() {
    setLoadError(null);
    Promise.allSettled([api.summary(), api.hourlyRisk(), api.hotspots(150)]).then(
      ([s, h, hs]) => {
        if (s.status === "fulfilled") setSummary(s.value.data);
        if (h.status === "fulfilled") setHourly(h.value.data);
        if (hs.status === "fulfilled") setHotspots(hs.value.data);
        if (s.status === "rejected" && h.status === "rejected" && hs.status === "rejected") {
          setLoadError(
            "Can't reach the backend. Check it's running and VITE_API_URL points to it."
          );
        }
      }
    );
  }

  async function checkPointRisk(latlng) {
    setPointCheck(latlng);
    setPointResult(null);
    setPointError(null);
    setPointLoading(true);
    try {
      const res = await api.predict(latlng[0], latlng[1]);
      setPointResult(res.data);
    } catch (e) {
      setPointError(e.response?.data?.detail || "Couldn't score this point. Try again.");
    } finally {
      setPointLoading(false);
    }
  }

  function handleMapClick(latlng) {
    if (pickingMode === "start") {
      setStartPoint(latlng);
      setPickingMode(null);
    } else if (pickingMode === "end") {
      setEndPoint(latlng);
      setPickingMode(null);
    } else if (pickingMode === "predict") {
      setPickingMode(null);
      checkPointRisk(latlng);
    }
  }

  function clearPoints() {
    setStartPoint(null);
    setEndPoint(null);
    setRouteResult(null);
    setPickingMode(null);
  }

  function clearPointCheck() {
    setPointCheck(null);
    setPointResult(null);
    setPointError(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setStartPoint([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
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
        <WeatherWidget center={pointCheck || DELHI_CENTER} />
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle dark / light mode">
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          {loadError && <div className="error-banner">{loadError}</div>}
          <Dashboard summary={summary} hourly={hourly} hotspots={hotspots} />
          <ModelInsights />
          <PointCheck
            pickingMode={pickingMode}
            setPickingMode={setPickingMode}
            point={pointCheck}
            result={pointResult}
            loading={pointLoading}
            error={pointError}
            onClear={clearPointCheck}
          />
          <RouteComparison
            pickingMode={pickingMode}
            setPickingMode={setPickingMode}
            startPoint={startPoint}
            endPoint={endPoint}
            setStartPoint={setStartPoint}
            setEndPoint={setEndPoint}
            clearPoints={clearPoints}
            routeResult={routeResult}
            setRouteResult={setRouteResult}
            useMyLocation={useMyLocation}
          />
        </aside>
        <main className="map-area">
          <MapView
            hotspots={hotspots}
            startPoint={startPoint}
            endPoint={endPoint}
            routeResult={routeResult}
            pointCheck={pointCheck}
            pointResult={pointResult}
            onMapClick={handleMapClick}
            theme={theme}
          />
        </main>
      </div>
    </div>
  );
}
