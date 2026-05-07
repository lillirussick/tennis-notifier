import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function calcNotifyAt(
  desiredDate: string,
  dropDayOffset: number | null,
  dropTime: string | null
): string | null {
  if (!dropDayOffset || !dropTime) return null;

  const [hh, mm] = dropTime.split(":").map(Number);
  const drop = new Date(desiredDate + "T00:00:00Z");
  drop.setUTCDate(drop.getUTCDate() - dropDayOffset);
  drop.setUTCHours(hh, mm - 5, 0, 0); // 5 minutes before drop
  return drop.toISOString();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, court_id, desired_date, desired_time_start } = body;

  if (!email || !court_id || !desired_date || !desired_time_start) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Check desired_date is in the future
  if (new Date(desired_date) <= new Date()) {
    return NextResponse.json({ error: "Date must be in the future" }, { status: 400 });
  }

  // Fetch court to get drop time info
  const { data: court, error: courtError } = await supabase
    .table("courts")
    .select("drop_day_offset, drop_time, drop_time_confidence")
    .eq("id", court_id)
    .single();

  if (courtError || !court) {
    return NextResponse.json({ error: "Court not found" }, { status: 404 });
  }

  const notify_at = calcNotifyAt(
    desired_date,
    court.drop_day_offset,
    court.drop_time
  );

  const { error } = await supabase.table("alerts").insert({
    email,
    court_id,
    desired_date,
    desired_time_start,
    notify_at,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    notify_at,
    drop_time_confidence: court.drop_time_confidence,
  });
}
