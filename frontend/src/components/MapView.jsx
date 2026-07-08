import React, { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  Marker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { riskColorHex } from "../api";

const DEFAULT_CENTER = [28.6139, 77.209]; // Delhi

const pinIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid #14171c;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
  });

function ClickCatcher({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function MapView({ hotspots, startPoint, endPoint, routeResult, onMapClick }) {
  const routeColors = ["#3ddc84", "#8b93a3"]; // recommended vs alternative baseline

  const polylines = useMemo(() => {
    if (!routeResult) return [];
    return routeResult.routes.map((r) => ({
      positions: r.geometry,
      color: r.route_index === routeResult.recommended_route_index ? "#ffc93c" : "#5c6472",
      weight: r.route_index === routeResult.recommended_route_index ? 5 : 3,
      dashArray: r.route_index === routeResult.recommended_route_index ? null : "6 6",
      route: r,
    }));
  }, [routeResult]);

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={11} className="leaflet-container">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors, tiles &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ClickCatcher onMapClick={onMapClick} />

      {hotspots.map((h) => (
        <CircleMarker
          key={h.location_id}
          center={[h.lat, h.lon]}
          radius={5 + h.avg_risk_score / 12}
          pathOptions={{
            color: riskColorHex(h.avg_risk_score),
            fillColor: riskColorHex(h.avg_risk_score),
            fillOpacity: 0.55,
            weight: 1,
          }}
        >
          <Popup>
            <div className="map-popup">
              <h3>{h.location_id}</h3>
              <div>Risk score: <b>{h.avg_risk_score}</b> / 100</div>
              <div>Road type: {h.road_type}</div>
              <div>Historical accidents: {h.accident_count}</div>
              {h.is_hotspot && <div style={{ color: "#e5484d" }}>⚠ Known hotspot</div>}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {polylines.map((p, i) => (
        <Polyline
          key={i}
          positions={p.positions}
          pathOptions={{ color: p.color, weight: p.weight, dashArray: p.dashArray }}
        />
      ))}

      {startPoint && <Marker position={startPoint} icon={pinIcon("#3ddc84")} />}
      {endPoint && <Marker position={endPoint} icon={pinIcon("#e5484d")} />}
    </MapContainer>
  );
}
