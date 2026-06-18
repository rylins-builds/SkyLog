import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DashboardStats } from "../api/types";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load dashboard: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-gray-500">Loading dashboard...</div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Flights" value={stats.total_flights} />
        <StatCard label="Total Hours" value={`${stats.total_hours.toFixed(1)}h`} />
        <StatCard label="PIC Hours" value={`${stats.total_pic_hours.toFixed(1)}h`} />
        <StatCard label="SIC Hours" value={`${stats.total_sic_hours.toFixed(1)}h`} />
        <StatCard label="Night Hours" value={`${stats.total_night_hours.toFixed(1)}h`} />
        <StatCard label="Instrument Hours" value={`${stats.total_instrument_hours.toFixed(1)}h`} />
        <StatCard label="Hours (Last 30 Days)" value={`${stats.hours_last_30_days.toFixed(1)}h`} />
        <StatCard label="Total Landings" value={stats.total_landings} />
        <StatCard label="Instrument Approaches" value={stats.total_approaches} />
        <StatCard label="Unique Aircraft" value={stats.unique_aircraft} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}