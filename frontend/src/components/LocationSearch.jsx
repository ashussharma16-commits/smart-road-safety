import React, { useState } from "react";
import axios from "axios";

// Nominatim (OpenStreetMap's free geocoder) - no API key, matches the
// project's "no signup needed" ethos used for weather/routing too.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export default function LocationSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(NOMINATIM_URL, {
        params: { q: query, format: "json", limit: 5, countrycodes: "in" },
      });
      setResults(res.data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function pick(r) {
    onSelect({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: r.display_name });
    setQuery(r.display_name.split(",")[0]);
    setOpen(false);
  }

  return (
    <div className="map-search">
      <form onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place… (e.g. IGI Airport)"
          onFocus={() => results.length && setOpen(true)}
        />
        <button type="submit" disabled={loading}>{loading ? "…" : "🔍"}</button>
      </form>
      {open && results.length > 0 && (
        <div className="map-search-results">
          {results.map((r) => (
            <div key={r.place_id} className="map-search-result" onClick={() => pick(r)}>
              {r.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
