"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RADIUS_OPTIONS = [1, 2, 3, 5, 10];

const STEPS = [
  { n: "01", title: "Search", body: "Enter your postcode and radius." },
  { n: "02", title: "Pick a court", body: "Browse courts with known drop times." },
  { n: "03", title: "Set an alert", body: "Choose your date, time and email." },
  { n: "04", title: "Book first", body: "We email you minutes before it opens." },
];

export default function Home() {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [radius, setRadius] = useState(3);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!postcode.trim()) {
      setError("Please enter a postcode.");
      return;
    }
    setLoading(true);
    router.push(`/courts?postcode=${encodeURIComponent(postcode.trim())}&radius=${radius}`);
  }

  return (
    <div className="h-full overflow-y-auto bg-stone-50">
      <div className="max-w-lg mx-auto px-6 py-6">

        {/* Hero */}
        <div className="mb-6">
          <span className="inline-block font-display font-semibold text-[11px] uppercase tracking-[0.25em] text-coral mb-3">
            Court booking alerts · London
          </span>
          <h1 className="font-display font-black uppercase leading-[0.88] text-brand text-[48px]">
            Find your<br />court<span className="text-coral">.</span>
          </h1>
          <p className="mt-4 text-gray-500 text-sm leading-relaxed">
            Get emailed minutes before your local court opens for booking — no more refreshing pages at midnight.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <label className="block font-display font-semibold text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1.5">
              Your postcode
            </label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="N5 2AL"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-medium
                         focus:outline-none focus:border-brand transition-colors bg-white
                         placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div>
            <label className="block font-display font-semibold text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1.5">
              Radius
            </label>
            <div className="flex gap-1.5">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadius(r)}
                  className={`flex-1 py-2 rounded-lg font-display font-bold uppercase tracking-wide text-sm transition-all
                    ${radius === r
                      ? "bg-brand text-white shadow-sm"
                      : "bg-white text-gray-400 border-2 border-gray-200 hover:border-brand hover:text-brand"
                    }`}
                >
                  {r}mi
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-coral text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-coral hover:bg-coral-dark text-white font-display font-bold
                       uppercase tracking-[0.15em] py-3.5 rounded-xl transition-all disabled:opacity-50
                       text-sm shadow-sm hover:shadow-md active:scale-[0.99]"
          >
            {loading ? "Searching…" : "Find courts →"}
          </button>
        </form>

        {/* How it works */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="font-display font-bold uppercase tracking-[0.15em] text-brand text-sm mb-3">
            How it works
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="font-display font-extrabold text-2xl text-coral leading-none mb-1.5">{n}</div>
                <div className="font-display font-bold uppercase tracking-wide text-brand text-xs mb-1">{title}</div>
                <p className="text-gray-400 text-[10px] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-gray-400 leading-relaxed">
            Courts tagged <span className="font-semibold text-gold">⏳ Learning</span> are new — we observe their schedule for ~2 weeks before notifications go live.
          </p>
        </div>
      </div>
    </div>
  );
}
