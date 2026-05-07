"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RADIUS_OPTIONS = [1, 2, 3, 5, 10];

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
    <div className="h-full overflow-y-auto">
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Find courts near you</h1>
        <p className="mt-2 text-gray-600">
          Get emailed the moment a court opens for booking — no more refreshing
          booking pages at midnight.
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your postcode
          </label>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. N5 2AL"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base
                       focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Radius
          </label>
          <div className="flex gap-2 flex-wrap">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors
                  ${radius === r
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-green-600"
                  }`}
              >
                {r} mile{r !== 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold
                     py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Searching…" : "Find courts"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">How it works</h2>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Search for courts near your postcode.</li>
          <li>Pick a court and the date + time you want to play.</li>
          <li>Enter your email — we&apos;ll notify you a few minutes before booking opens.</li>
          <li>Click the link in the email and book before anyone else.</li>
        </ol>
        <p className="text-xs text-gray-400 pt-1">
          Courts with an <span className="font-medium text-amber-600">⏳ Learning</span> badge
          are new to us — we&apos;re observing their booking schedule. Reliable notifications
          will kick in within 2 weeks of your first search.
        </p>
      </div>
    </div>
    </div>
  );
}
