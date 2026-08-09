import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// center: { lat, lng } of the search point
// pgs:    [{ id, name, latitude, longitude, monthly_rent, distance_km }]
export default function PGMap({ center, pgs }) {
  const mapRef = useRef(null);       // the <div> the map attaches to
  const mapInstance = useRef(null);  // the Leaflet map object
  const markers = useRef([]);        // markers currently on the map

  // Create the map ONCE. Empty deps = only runs on first render.
  useEffect(() => {
    if (mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current).setView(
      [center.lat, center.lng],
      14
    );
    // OpenStreetMap tiles are free — no API key needed.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapInstance.current);
  }, []);

  // Re-draw markers whenever the results or center change.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const hasCenter = Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng));

    // 1. The search point (your college) - black dot (only when valid)
    if (hasCenter) {
      const searchDot = L.circleMarker([Number(center.lat), Number(center.lng)], {
        radius: 9,
        color: "#141414",
        fillColor: "#141414",
        fillOpacity: 0.9,
      })
        .bindPopup("<b>Your location</b>")
        .addTo(map);
      markers.current.push(searchDot);
    }

    // 2. One numbered marker per PG (skip PGs without coordinates)
    const withCoords = pgs.filter(
      (pg) =>
        pg.latitude != null &&
        pg.longitude != null &&
        Number.isFinite(Number(pg.latitude)) &&
        Number.isFinite(Number(pg.longitude))
    );
    withCoords.forEach((pg, i) => {
      const icon = L.divIcon({
        className: "pg-marker",
        html: `<div class="pg-marker-inner">${i + 1}</div>`,
      });
      const m = L.marker([Number(pg.latitude), Number(pg.longitude)], { icon })
        .addTo(map)
        .bindPopup(
          `<b>${pg.name}</b><br/>Rs ${pg.monthly_rent}/month<br/>${Number(pg.distance_km || 0).toFixed(2)} km away`
        );
      markers.current.push(m);
    });

    // Zoom so every marker is visible.
    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(
        withCoords.map((pg) => [Number(pg.latitude), Number(pg.longitude)])
      );
      if (hasCenter) bounds.extend([Number(center.lat), Number(center.lng)]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (hasCenter) {
      map.setView([Number(center.lat), Number(center.lng)], 14);
    } else {
      map.setView([21.1195, 79.0458], 13);
    }
  }, [pgs, center]);

  return <div ref={mapRef} className="map" />;
}
