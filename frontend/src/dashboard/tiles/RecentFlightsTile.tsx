/**
 * RecentFlightsTile — displays the 5 most recent flight entries in a compact table.
 *
 * This tile spans 2 columns by default.
 *
 * @module dashboard/tiles/RecentFlightsTile
 */

import type { Flight } from "../../api/types";

interface RecentFlightsTileProps {
  flights: Flight[];
}

export function RecentFlightsTile({ flights }: RecentFlightsTileProps) {
  if (flights.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 text-center dark:bg-zinc-900 dark:border-zinc-400 animate-slide-up">
        <p className="text-gray-500 dark:text-gray-400">No recent flights to display.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-slide-up dark:bg-zinc-900 dark:border-zinc-400">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Flights</h2>
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
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Date</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Aircraft</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Reg.</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">From → To</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Total</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">PIC</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">SIC</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((flight, idx) => (
              <tr
                key={flight.id}
                className="border-b border-gray-50 hover:bg-gray-50 logbook-row dark:border-zinc-400 dark:hover:bg-zinc-700"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.date}</td>
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.aircraft_type}</td>
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.aircraft_reg}</td>
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {flight.departure}→{flight.arrival}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {flight.total_time.toFixed(1)}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {flight.pic_time.toFixed(1)}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">
                  {flight.sic_time.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
