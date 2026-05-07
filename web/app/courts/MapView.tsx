"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const courtIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#16a34a;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

const courtIconSelected = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#15803d;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

const originIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
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
  selectedId: string | null;
  onCourtSelect: (id: string) => void;
  onBoundsChange: (ids: string[]) => void;
}

function BoundsTracker({
  courts,
  onBoundsChange,
}: {
  courts: Court[];
  onBoundsChange: (ids: string[]) => void;
}) {
  function getVisible(map: L.Map) {
    const bounds = map.getBounds();
    return courts.filter((c) => bounds.contains([c.lat, c.lng])).map((c) => c.id);
  }

  const map = useMapEvents({
    moveend: () => onBoundsChange(getVisible(map)),
    zoomend: () => onBoundsChange(getVisible(map)),
  });

  useEffect(() => {
    onBoundsChange(getVisible(map));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courts]);

  return null;
}

export default function MapView({ origin, courts, selectedId, onCourtSelect, onBoundsChange }: Props) {
  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={13}
      className="h-full w-full"
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsTracker courts={courts} onBoundsChange={onBoundsChange} />

      <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
        <Popup>
          <span className="text-sm font-medium">Your location</span>
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
            <div className="text-sm font-medium">{court.name}</div>
            <div className="text-xs text-gray-500">{court.distance_miles.toFixed(1)} mi away</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
