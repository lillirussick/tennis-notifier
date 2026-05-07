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
      <span className="inline-flex items-center gap-1 font-display font-semibold text-[10px] uppercase tracking-wider bg-gold/10 text-gold-dark border border-gold/30 rounded-full px-2 py-0.5">
        ⏳ Learning
      </span>
    );
  }
  if (confidence === "learned") {
    return (
      <span className="inline-flex items-center gap-1 font-display font-semibold text-[10px] uppercase tracking-wider bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5">
        ◎ Estimated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-display font-semibold text-[10px] uppercase tracking-wider bg-coral/10 text-coral-dark border border-coral/20 rounded-full px-2 py-0.5">
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
      <div className="mt-3 bg-brand/5 border border-brand/20 rounded-xl p-3">
        <p className="font-display font-bold uppercase tracking-wide text-brand text-xs">✓ Alert set</p>
        <p className="text-gray-600 text-xs mt-1 leading-relaxed">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      {court.drop_time_confidence === "unknown" && (
        <p className="text-xs text-gold-dark bg-gold/10 border border-gold/20 rounded-xl p-2.5 leading-relaxed">
          ⏳ Still learning this court&apos;s booking pattern — usually takes ~2 weeks to confirm.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block font-display font-semibold text-[10px] uppercase tracking-wider text-gray-400 mb-1">Date</label>
          <input
            type="date"
            required
            min={minDateStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-2.5 py-1.5 text-sm font-medium
                       focus:outline-none focus:border-brand transition-colors bg-white"
          />
        </div>
        <div>
          <label className="block font-display font-semibold text-[10px] uppercase tracking-wider text-gray-400 mb-1">Time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-2.5 py-1.5 text-sm font-medium
                       focus:outline-none focus:border-brand transition-colors bg-white"
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block font-display font-semibold text-[10px] uppercase tracking-wider text-gray-400 mb-1">Email</label>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-2.5 py-1.5 text-sm font-medium
                     focus:outline-none focus:border-brand transition-colors bg-white
                     placeholder:text-gray-300 placeholder:font-normal"
        />
      </div>

      {status === "error" && <p className="text-coral text-xs font-medium">{message}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-coral hover:bg-coral-dark text-white font-display font-bold
                   uppercase tracking-widest py-2.5 rounded-xl transition-all disabled:opacity-50
                   text-xs active:scale-[0.99]"
      >
        {status === "loading" ? "Setting alert…" : "Notify me →"}
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
      ? `${court.drop_day_offset}d before · ${court.drop_time.slice(0, 5)}`
      : "Drop time unknown";

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-2xl p-4 cursor-pointer transition-all
        ${selected
          ? "ring-2 ring-coral shadow-md shadow-coral/10"
          : "border border-gray-100 hover:shadow-sm hover:border-gray-200"
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold uppercase tracking-wide text-brand text-sm leading-tight">
            {court.name}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {court.postcode} · {court.distance_miles.toFixed(1)} mi
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <DropTimeBadge confidence={court.drop_time_confidence} />
            <span className="text-[10px] text-gray-400 font-medium">{dropLabel}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className={`shrink-0 font-display font-bold uppercase tracking-wide text-xs px-3 py-1.5 rounded-lg transition-all whitespace-nowrap
            ${open
              ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
              : "bg-coral text-white hover:bg-coral-dark active:scale-[0.98]"
            }`}
        >
          {open ? "Cancel" : "Alert →"}
        </button>
      </div>

      {open && <AlertForm court={court} />}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 flex flex-col border-r border-gray-200 bg-stone-50">
        <div className="bg-brand px-5 py-4 shrink-0">
          <div className="h-5 w-40 bg-white/20 rounded animate-pulse" />
          <div className="h-3 w-24 bg-white/10 rounded mt-2 animate-pulse" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 h-20 animate-pulse border border-gray-100" />
          ))}
        </div>
      </div>
      <div className="flex-1 bg-gray-100 animate-pulse" />
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

  if (loading) return <SidebarSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-stone-50">
        <div className="text-center max-w-xs">
          <p className="font-display font-bold uppercase tracking-wide text-brand text-lg mb-2">
            Something went wrong
          </p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <a href="/" className="inline-block bg-coral text-white font-display font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-xl hover:bg-coral-dark transition-colors">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-96 shrink-0 flex flex-col border-r border-gray-200 bg-stone-50">
        {/* Sidebar header */}
        <div className="bg-brand px-5 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display font-bold uppercase tracking-[0.12em] text-white text-base leading-tight">
                Courts near {postcode}
              </h1>
              <p className="text-white/50 text-xs font-display uppercase tracking-wider mt-0.5">
                Within {radius} mile{radius !== "1" ? "s" : ""}
                {displayCourts.length > 0 && ` · ${displayCourts.length} shown`}
              </p>
            </div>
            <a href="/" className="text-white/60 hover:text-white font-display font-semibold uppercase tracking-wider text-[10px] transition-colors mt-0.5">
              ← Back
            </a>
          </div>
        </div>

        {/* Court list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {displayCourts.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-display font-bold uppercase tracking-wide text-brand text-sm">
                No courts in view
              </p>
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
                <p className="text-center text-[10px] text-gray-400 font-display uppercase tracking-wider py-3">
                  +{hiddenCount} court{hiddenCount !== 1 ? "s" : ""} outside view
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Map */}
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
    <Suspense fallback={<SidebarSkeleton />}>
      <CourtsContent />
    </Suspense>
  );
}
