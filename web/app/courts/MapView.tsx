"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TENNIS_BALL_COLOR = "#c8e040";

function makeTennisBall(size: number, ringColor?: string): string {
  const r = size / 2;
  const seam1X = size * 0.2;
  const seam2X = size * 0.8;
  const seamY1 = size * 0.27;
  const seamMidY = size * 0.5;
  const seamY2 = size * 0.73;
  const ring = ringColor
    ? `<circle cx="${r}" cy="${r}" r="${r - 1}" fill="none" stroke="${ringColor}" stroke-width="2.5"/>`
    : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r}" fill="${TENNIS_BALL_COLOR}" stroke="white" stroke-width="1.5"/>
    <path d="M${seam1X},${seamY1} Q${size * 0.42},${seamMidY} ${seam1X},${seamY2}"
          fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M${seam2X},${seamY1} Q${size * 0.58},${seamMidY} ${seam2X},${seamY2}"
          fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    ${ring}
  </svg>`;
}

const courtIcon = L.divIcon({
  className: "",
  html: makeTennisBall(20),
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

const courtIconSelected = L.divIcon({
  className: "",
  html: makeTennisBall(26, "#124d54"),
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -15],
});

const originIcon = L.divIcon({
  className: "",
  html: `<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 19 11 19S22 19.3 22 11C22 4.9 17.1 0 11 0z"
          fill="#0d3a3f" stroke="white" stroke-width="1.5"/>
    <circle cx="11" cy="11" r="4" fill="white"/>
  </svg>`,
  iconSize: [22, 30],
  iconAnchor: [11, 30],
  popupAnchor: [0, -32],
});

interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance_miles: number;
}

interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  origin: Coords;
  courts: Court[];
  radius: number;
  selectedId: string | null;
  onCourtSelect: (id: string) => void;
  onBoundsChange: (ids: string[]) => void;
}

function getVisibleIds(map: L.Map, courts: Court[]): string[] {
  const bounds = map.getBounds();
  return courts.filter((c) => bounds.contains([c.lat, c.lng])).map((c) => c.id);
}

function BoundsTracker({
  courts,
  onBoundsChange,
}: {
  courts: Court[];
  onBoundsChange: (ids: string[]) => void;
}) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(getVisibleIds(map, courts)),
    zoomend: () => onBoundsChange(getVisibleIds(map, courts)),
  });

  useEffect(() => {
    onBoundsChange(getVisibleIds(map, courts));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courts]);

  return null;
}

function FitBounds({ origin, radius }: { origin: Coords; radius: number }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const km = radius * 1.60934;
    const latDelta = km / 111;
    const lngDelta = km / (111 * Math.cos((origin.lat * Math.PI) / 180));
    const bounds = L.latLngBounds(
      [origin.lat - latDelta, origin.lng - lngDelta],
      [origin.lat + latDelta, origin.lng + lngDelta]
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function MapView({ origin, courts, radius, selectedId, onCourtSelect, onBoundsChange }: Props) {
  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={13}
      className="h-full w-full"
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <BoundsTracker courts={courts} onBoundsChange={onBoundsChange} />
      <FitBounds origin={origin} radius={radius} />

      <Marker position={[origin.lat, origin.lng]} icon={originIcon} zIndexOffset={1000}>
        <Popup>
          <span style={{ fontFamily: "sans-serif", fontSize: "12px", fontWeight: 600 }}>Your location</span>
        </Popup>
      </Marker>

      {courts.map((court) => (
        <Marker
          key={court.id}
          position={[court.lat, court.lng]}
          icon={court.id === selectedId ? courtIconSelected : courtIcon}
          eventHandlers={{ click: () => onCourtSelect(court.id) }}
        >
          <Popup>
            <div style={{ fontFamily: "sans-serif", fontSize: "12px", fontWeight: 700, color: "#124d54" }}>
              {court.name}
            </div>
            <div style={{ fontFamily: "sans-serif", fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
              {court.distance_miles.toFixed(1)} mi from search
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
