"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

interface Court {
  id: string;
  name: string;
  postcode: string;
  lat: number;
  lng: number;
  distance_miles: number;
  drop_day_offset: number | null;
  drop_time: string | null;
  drop_time_confidence: "unknown" | "learned" | "confirmed";
}

interface Coords {
  lat: number;
  lng: number;
}

const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, "0")}:00`;
});

function DropTimeBadge({ confidence }: { confidence: Court["drop_time_confidence"] }) {
  if (confidence === "unknown") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
        ⏳ Learning
      </span>
    );
  }
  if (confidence === "learned") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
        📊 Estimated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
      ✓ Confirmed
    </span>
  );
}

function AlertForm({ court }: { court: Court }) {
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          court_id: court.id,
          desired_date: date,
          desired_time_start: time,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }
      setStatus("success");
      if (data.notify_at) {
        const notifyDate = new Date(data.notify_at);
        setMessage(
          `We'll email you at ${notifyDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} on ${notifyDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`
        );
      } else {
        setMessage(
          "Alert saved. We're still learning this court's schedule — you'll be notified once we know the drop time (within ~2 weeks)."
        );
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-green-800 text-sm font-medium">✓ Alert set</p>
        <p className="text-green-700 text-sm mt-1">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      {court.drop_time_confidence === "unknown" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
          ⏳ We&apos;re still learning when this court&apos;s bookings drop. We&apos;ll notify you once we&apos;ve observed the pattern — usually within 2 weeks.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            required
            min={minDateStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your email</label>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      {status === "error" && (
        <p className="text-red-600 text-sm">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold
                   py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {status === "loading" ? "Setting alert…" : "Notify me"}
      </button>
    </form>
  );
}

function CourtCard({
  court,
  selected,
  onSelect,
}: {
  court: Court;
  selected: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);

  const dropLabel =
    court.drop_time && court.drop_day_offset
      ? `Opens ${court.drop_day_offset}d before at ${court.drop_time.slice(0, 5)}`
      : "Drop time unknown";

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all
        ${selected ? "border-green-500 ring-1 ring-green-400 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{court.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {court.postcode} · {court.distance_miles.toFixed(1)} mi
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <DropTimeBadge confidence={court.drop_time_confidence} />
            <span className="text-xs text-gray-400">{dropLabel}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-xs
                     font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          {open ? "Cancel" : "Get notified"}
        </button>
      </div>

      {open && <AlertForm court={court} />}
    </div>
  );
}

function CourtsContent() {
  const params = useSearchParams();
  const postcode = params.get("postcode") ?? "";
  const radius = params.get("radius") ?? "3";

  const [courts, setCourts] = useState<Court[]>([]);
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!postcode) return;
    fetch(`/api/courts?postcode=${encodeURIComponent(postcode)}&radius=${radius}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setCourts(data.courts);
          setOrigin(data.origin);
        }
      })
      .catch(() => setError("Failed to load courts."))
      .finally(() => setLoading(false));
  }, [postcode, radius]);

  useEffect(() => {
    if (selectedId) {
      const el = cardRefs.current.get(selectedId);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const displayCourts = visibleIds.length > 0
    ? courts.filter((c) => visibleIds.includes(c.id))
    : courts;

  const hiddenCount = courts.length - displayCourts.length;

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="w-96 shrink-0 p-4 space-y-3 overflow-y-auto border-r border-gray-200 bg-gray-50">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-20" />
          ))}
        </div>
        <div className="flex-1 bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm">
          <p className="text-red-700">{error}</p>
          <a href="/" className="text-sm text-red-600 underline mt-2 inline-block">Try again</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-96 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-gray-900">Courts near {postcode}</h1>
              <p className="text-xs text-gray-500">Within {radius} mile{radius !== "1" ? "s" : ""}</p>
            </div>
            <a href="/" className="text-xs text-green-600 hover:text-green-700 font-medium">
              ← Change
            </a>
          </div>
        </div>

        {/* Court list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {displayCourts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No courts in current view.</p>
              <p className="text-gray-400 text-xs mt-1">Zoom out or pan the map.</p>
            </div>
          ) : (
            <>
              {displayCourts.map((court) => (
                <div
                  key={court.id}
                  ref={(el) => { if (el) cardRefs.current.set(court.id, el); }}
                >
                  <CourtCard
                    court={court}
                    selected={court.id === selectedId}
                    onSelect={() => setSelectedId(court.id)}
                  />
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-center text-xs text-gray-400 py-2">
                  +{hiddenCount} court{hiddenCount !== 1 ? "s" : ""} outside current view — zoom or pan to see them
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Map panel */}
      <div className="flex-1 relative">
        {origin && (
          <MapView
            origin={origin}
            courts={courts}
            selectedId={selectedId}
            onCourtSelect={(id) => setSelectedId(id)}
            onBoundsChange={setVisibleIds}
          />
        )}
      </div>
    </div>
  );
}

export default function CourtsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full">
          <div className="w-96 shrink-0 p-4 space-y-3 border-r border-gray-200 bg-gray-50">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-20" />
            ))}
          </div>
          <div className="flex-1 bg-gray-100 animate-pulse" />
        </div>
      }
    >
      <CourtsContent />
    </Suspense>
  );
}
