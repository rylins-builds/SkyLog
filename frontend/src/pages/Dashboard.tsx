import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DashboardStats, Flight } from "../api/types";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFlights, setRecentFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.listFlights(),
    ])
      .then(([statsData, flightsData]) => {
        setStats(statsData);
        setRecentFlights(flightsData.slice(0, 5));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:text-red-300">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to load dashboard: {error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 max-w-[80%] mx-auto animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 dark:bg-zinc-900">
              <div className="skeleton h-4 w-24 mb-3" />
              <div className="skeleton h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If no flights logged
  if (stats.total_flights === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto animate-fade-in dark:bg-zinc-800">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-white">Dashboard</h1>
        <div className="text-center py-16">
          {/* Aviation icon */}
          <div className="text-6xl mb-4">✈️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">Welcome to SkyLog!</h2>
          <p className="text-gray-500 mb-6 dark:text-white">
            Your flight data will appear here once you start logging.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "add" }))}
            className="inline-flex items-center gap-2 bg-blue-600 dark:bg-blue-800 dark:text-white text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors btn-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Your First Flight
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-[80%] mx-auto animate-fade-in dark:bg-zinc-800">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 dark:text-white dark:bg-zinc-800 dark:border-zinc-300">
        <StatCard label="Total Flights" value={stats.total_flights} icon="📊" />
        <StatCard label="Total Hours" value={`${stats.total_hours.toFixed(1)}`} icon="⏱️" />
        <StatCard label="Night Hours" value={`${stats.total_night_hours.toFixed(1)}`} icon="🌙" />
        <StatCard label="Hours (Last 30 Days)" value={`${stats.hours_last_30_days.toFixed(1)}`} icon="📅" />
        <StatCard label="Total Landings" value={stats.total_landings} icon="🛬" />
        <StatCard label="Unique Aircraft" value={stats.unique_aircraft} icon="🛩️" />
      </div>

      {/* Recent Flights Section */}
      {recentFlights.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-slide-up dark:bg-zinc-900 dark:border-zinc-600">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Flights</h2>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "logbook" }))}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300"
            >
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800">
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">Date</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">Aircraft</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">Registration</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">From → To</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">Total</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">PIC</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-white">SIC</th>
                </tr>
              </thead>
              <tbody>
                {recentFlights.map((flight, idx) => (
                  <tr
                    key={flight.id}
                    className="border-b border-gray-50 hover:bg-gray-50 logbook-row dark:border-zinc-600 dark:hover:bg-zinc-700"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.date}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.aircraft_type}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.aircraft_reg}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.departure} → {flight.arrival}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.total_time.toFixed(1)}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.pic_time.toFixed(1)}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{flight.sic_time.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 stat-card animate-slide-up dark:bg-zinc-900 dark:border-zinc-600">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
