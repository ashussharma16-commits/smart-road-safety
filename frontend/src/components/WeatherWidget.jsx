import React, { useEffect, useState } from "react";
import { api } from "../api";

const ICONS = {
  fog: "🌫️",
  rain: "🌧️",
  clear: "☀️",
};

function pickIcon(w) {
  if (w.fog) return ICONS.fog;
  if (w.rain_mm > 0) return ICONS.rain;
  return ICONS.clear;
}

export default function WeatherWidget({ center }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!center) return;
    setLoading(true);
    api
      .weather(center[0], center[1])
      .then((r) => setWeather(r.data))
      .catch(() => setWeather(null))
      .finally(() => setLoading(false));
  }, [center]);

  if (loading) return <div className="weather-chip loading-line">Fetching live weather…</div>;
  if (!weather) return null;

  const isLive = weather.source === "open-meteo";

  return (
    <div className="weather-chip" title={isLive ? "Live from Open-Meteo" : "Offline fallback values"}>
      <span className="weather-icon">{pickIcon(weather)}</span>
      <span>{weather.temperature_c.toFixed(0)}°C</span>
      <span className="weather-sep">·</span>
      <span>{weather.humidity}% humidity</span>
      {weather.fog && <span className="weather-sep">· fog</span>}
      {weather.rain_mm > 0 && <span className="weather-sep">· {weather.rain_mm}mm rain</span>}
      <span className={"weather-source" + (isLive ? " live" : " fallback")}>
        {isLive ? "LIVE" : "OFFLINE"}
      </span>
    </div>
  );
}
