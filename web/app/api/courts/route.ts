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
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const postcode = searchParams.get("postcode") ?? "";
  const radius   = parseFloat(searchParams.get("radius") ?? "3");

  if (!postcode) {
    return NextResponse.json({ error: "postcode required" }, { status: 400 });
  }

  const coords = await geocodePostcode(postcode);
  if (!coords) {
    return NextResponse.json({ error: "Invalid postcode" }, { status: 422 });
  }

  const { data: courts, error } = await supabase
    .from("courts")
    .select("id, name, postcode, lat, lng, drop_day_offset, drop_time, drop_time_confidence, clubspark_slug, venue_uuid");

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const nearby = (courts as Court[] ?? [])
    .filter((c: Court) => c.lat && c.lng)
    .map((c: Court) => ({
      ...c,
      distance_miles: distanceMiles(coords, { lat: c.lat, lng: c.lng } as Coords),
    }))
    .filter((c: Court & { distance_miles: number }) => c.distance_miles <= radius)
    .sort((a: Court & { distance_miles: number }, b: Court & { distance_miles: number }) => a.distance_miles - b.distance_miles);

  return NextResponse.json({ courts: nearby, origin: coords });
}
