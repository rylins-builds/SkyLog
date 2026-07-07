/**
 * SkyLog FAA 8710 Form Page (Stub)
 *
 * This page is a placeholder for a future FAA Form 8710 (Airman Certificate
 * and/or Rating Application) generator. The intent is to automatically
 * populate the 8710 fields from the pilot's logbook data so that applying
 * for a new certificate or rating requires minimal manual data entry.
 *
 * Currently the page only shows a heading — the full form will be built
 * in a future iteration once the logbook data model stabilises.
 *
 * @module pages/FAA8710
 */

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";

export default function FAA8710() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");

  // On mount, fetch all flights (will be used to pre-populate the form).
  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  // ── Error state ──
  if (error) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          <span>Failed to load flights: {error}</span>
        </div>
      </div>
    );
  }

  // ── Empty state — no flights available to populate the form ──
  if (flights.length === 0) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="max-w-md mx-auto py-16">
          <div className="text-6xl mb-4">📖</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">No flights logged yet</h2>
          <p className="text-gray-500 mb-6 dark:text-white">
            Ready for takeoff? Add your first flight to get started.
          </p>
          {/* Navigate to the Add Flight page via custom event */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "add" }))}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors btn-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Flight
          </button>
        </div>
      </div>
    );
  }

  // ── Future: the FAA 8710 form will render here ──
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">FAA 8710</h1>
      <p className="text-gray-500 dark:text-gray-400">FAA Form 8710 generation coming soon.</p>
      {/* TODO: Build the 8710 form using flight data */}
    </div>
  );
}
