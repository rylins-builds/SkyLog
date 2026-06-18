import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";

export default function Logbook() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Failed to load flights: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Logbook</h1>

      {flights.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No flights logged yet.</p>
          <p className="text-sm mt-2">Add your first flight to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="px-3 py-3 font-semibold text-gray-600">Date</th>
                <th className="px-3 py-3 font-semibold text-gray-600">Aircraft</th>
                <th className="px-3 py-3 font-semibold text-gray-600">Route</th>
                <th className="px-3 py-3 font-semibold text-gray-600">Total</th>
                <th className="px-3 py-3 font-semibold text-gray-600">PIC</th>
                <th className="px-3 py-3 font-semibold text-gray-600">SIC</th>
                <th className="px-3 py-3 font-semibold text-gray-600">Night</th>
                <th className="px-3 py-3 font-semibold text-gray-600">Inst</th>
                <th className="px-3 py-3 font-semibold text-gray-600">Appr</th>
                <th className="px-3 py-3 font-semibold text-gray-600">PIC Name</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((flight) => (
                <tr key={flight.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{flight.date}</td>
                  <td className="px-3 py-3">
                    <span className="text-gray-900">{flight.aircraft_type}</span>
                    <span className="text-gray-500 ml-1">({flight.aircraft_reg})</span>
                  </td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                    {flight.departure} &rarr; {flight.arrival}
                  </td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{flight.total_time.toFixed(1)}h</td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{flight.pic_time.toFixed(1)}h</td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{flight.sic_time.toFixed(1)}h</td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{flight.night_time.toFixed(1)}h</td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                    {(flight.actual_instrument + flight.sim_instrument).toFixed(1)}h
                  </td>
                  <td className="px-3 py-3 text-gray-900 whitespace-nowrap">{flight.approaches}</td>
                  <td className="px-3 py-3 text-gray-900">{flight.pilot_in_command}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}