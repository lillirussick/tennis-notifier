import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { distanceMiles, geocodePostcode } from "@/lib/geocode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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
    .table("courts")
    .select("id, name, postcode, lat, lng, drop_day_offset, drop_time, drop_time_confidence");

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const nearby = (courts ?? [])
    .filter((c) => c.lat && c.lng)
    .map((c) => ({
      ...c,
      distance_miles: distanceMiles(coords, { lat: c.lat, lng: c.lng }),
    }))
    .filter((c) => c.distance_miles <= radius)
    .sort((a, b) => a.distance_miles - b.distance_miles);

  return NextResponse.json({ courts: nearby, origin: coords });
}
