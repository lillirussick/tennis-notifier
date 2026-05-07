import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceMiles, geocodePostcode, Coords } from "@/lib/geocode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Court {
  id: string;
  name: string;
  postcode: string;
  lat: number;
  lng: number;
  drop_day_offset: number | null;
  drop_time: string | null;
  drop_time_confidence: "unknown" | "learned" | "confirmed";
  clubspark_slug: string | null;
  venue_uuid: string | null;
  booking_url: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const postcode = searchParams.get("postcode") ?? "";

  if (!postcode) {
    return NextResponse.json({ error: "postcode required" }, { status: 400 });
  }

  const coords = await geocodePostcode(postcode);
  if (!coords) {
    return NextResponse.json({ error: "Invalid postcode" }, { status: 422 });
  }

  const { data: courts, error } = await supabase
    .from("courts")
    .select("id, name, postcode, lat, lng, drop_day_offset, drop_time, drop_time_confidence, clubspark_slug, venue_uuid, booking_url");

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Return all courts with valid coordinates, sorted by distance from searched postcode.
  // Radius filtering is handled by the map viewport on the client.
  const all = (courts as Court[] ?? [])
    .filter((c: Court) => c.lat && c.lng)
    .map((c: Court) => ({
      ...c,
      distance_miles: distanceMiles(coords, { lat: c.lat, lng: c.lng } as Coords),
    }))
    .sort((a, b) => a.distance_miles - b.distance_miles);

  return NextResponse.json({ courts: all, origin: coords });
}
