export interface Coords {
  lat: number;
  lng: number;
}

export async function geocodePostcode(postcode: string): Promise<Coords | null> {
  const clean = postcode.replace(/\s/g, "").toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.result) return null;
  return { lat: data.result.latitude, lng: data.result.longitude };
}

// Haversine distance in miles
export function distanceMiles(a: Coords, b: Coords): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
