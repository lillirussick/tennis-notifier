"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface Court {
  id: string;
  name: string;
  postcode: string;
  distance_miles: number;
  drop_day_offset: number | null;
  drop_time: string | null;
  drop_time_confidence: "unknown" | "learned" | "confirmed";
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
      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800 text-sm font-medium">✓ Alert set</p>
        <p className="text-green-700 text-sm mt-1">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      {court.drop_time_confidence === "unknown" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          ⏳ We&apos;re still learning when this court&apos;s bookings drop. We&apos;ll send
          your notification once we&apos;ve observed the pattern — usually within 2 weeks.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            required
            min={minDateStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Preferred time</label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
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
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
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
                   py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {status === "loading" ? "Setting alert…" : "Notify me"}
      </button>
    </form>
  );
}

function CourtCard({ court }: { court: Court }) {
  const [open, setOpen] = useState(false);

  const dropLabel =
    court.drop_time && court.drop_day_offset
      ? `Opens ${court.drop_day_offset}d before at ${court.drop_time.slice(0, 5)}`
      : "Drop time unknown";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{court.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {court.postcode} · {court.distance_miles.toFixed(1)} mi
          </p>
          <div className="flex items-center gap-2 mt-2">
            <DropTimeBadge confidence={court.drop_time_confidence} />
            <span className="text-xs text-gray-500">{dropLabel}</span>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm
                     font-medium px-4 py-2 rounded-lg transition-colors"
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
  const radius   = params.get("radius") ?? "3";

  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postcode) return;
    fetch(`/api/courts?postcode=${encodeURIComponent(postcode)}&radius=${radius}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setCourts(data.courts);
        }
      })
      .catch(() => setError("Failed to load courts."))
      .finally(() => setLoading(false));
  }, [postcode, radius]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courts near {postcode}</h1>
          <p className="text-sm text-gray-500 mt-1">Within {radius} mile{radius !== "1" ? "s" : ""}</p>
        </div>
        <a
          href="/"
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          ← Change search
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-red-700">{error}</p>
          <a href="/" className="text-sm text-red-600 underline mt-2 inline-block">Try again</a>
        </div>
      ) : courts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No courts found within {radius} mile{radius !== "1" ? "s" : ""} of {postcode}.</p>
          <a href="/" className="text-green-600 underline text-sm mt-2 inline-block">Search again</a>
        </div>
      ) : (
        <div className="space-y-3">
          {courts.map((court) => (
            <CourtCard key={court.id} court={court} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourtsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 rounded animate-pulse w-64" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <CourtsContent />
    </Suspense>
  );
}
