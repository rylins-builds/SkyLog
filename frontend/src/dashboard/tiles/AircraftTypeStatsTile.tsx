/**
 * AircraftTypeStatsTile — displays per-aircraft-type aggregated statistics
 * in a scrollable table within a dashboard card.
 *
 * Columns match the full Logbook page schema: Aircraft Type, Total Hours,
 * Flights, Days Since, then SEL, SES, MEL, MES, Helicopter, Gyroplane,
 * Powered Lift, Glider, Balloon, Airship, Solo, PIC, SIC, Dual,
 * Instructor, Cross Country, Night, Actual Instrument, Simulated Instrument,
 * Full Flight Sim, FTD, ATD, Day Takeoffs, Night Takeoffs, Day Landings,
 * Night Landings, Precision, Non-Precision, Holding.
 *
 * The bottom row shows combined totals across all aircraft types.
 *
 * @module dashboard/tiles/AircraftTypeStatsTile
 */

import type { AircraftTypeStat } from "../../api/types";

interface AircraftTypeStatsTileProps {
  stats: AircraftTypeStat[];
}

function num(n: number) {
  return n.toFixed(1);
}

function nInt(n: number) {
  return n;
}

export function AircraftTypeStatsTile({ stats }: AircraftTypeStatsTileProps) {
  if (stats.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 text-center dark:bg-zinc-900 dark:border-zinc-400 animate-slide-up">
        <p className="text-gray-500 dark:text-gray-400">No aircraft type data to display.</p>
      </div>
    );
  }

  // Compute totals row
  const totals = stats.reduce(
    (acc, s) => ({
      total_hours: acc.total_hours + s.total_hours,
      flight_count: acc.flight_count + s.flight_count,
      sel_time: acc.sel_time + s.sel_time,
      ses_time: acc.ses_time + s.ses_time,
      mel_time: acc.mel_time + s.mel_time,
      mes_time: acc.mes_time + s.mes_time,
      helicopter_time: acc.helicopter_time + s.helicopter_time,
      gyroplane_time: acc.gyroplane_time + s.gyroplane_time,
      powered_lift_time: acc.powered_lift_time + s.powered_lift_time,
      glider_time: acc.glider_time + s.glider_time,
      balloon_time: acc.balloon_time + s.balloon_time,
      airship_time: acc.airship_time + s.airship_time,
      solo_time: acc.solo_time + s.solo_time,
      pic_time: acc.pic_time + s.pic_time,
      sic_time: acc.sic_time + s.sic_time,
      dual_time: acc.dual_time + s.dual_time,
      instructor_time: acc.instructor_time + s.instructor_time,
      xcountry_time: acc.xcountry_time + s.xcountry_time,
      night_time: acc.night_time + s.night_time,
      act_instrument_time: acc.act_instrument_time + s.act_instrument_time,
      sim_instrument_time: acc.sim_instrument_time + s.sim_instrument_time,
      full_flight_simulator_time: acc.full_flight_simulator_time + s.full_flight_simulator_time,
      flight_training_device_time: acc.flight_training_device_time + s.flight_training_device_time,
      aviation_training_device_time: acc.aviation_training_device_time + s.aviation_training_device_time,
      takeoffs_day: acc.takeoffs_day + s.takeoffs_day,
      takeoffs_night: acc.takeoffs_night + s.takeoffs_night,
      landings_day: acc.landings_day + s.landings_day,
      landings_night: acc.landings_night + s.landings_night,
      precision_approaches: acc.precision_approaches + s.precision_approaches,
      non_precision_approaches: acc.non_precision_approaches + s.non_precision_approaches,
      holding_patterns: acc.holding_patterns + s.holding_patterns,
    }),
    {
      total_hours: 0,
      flight_count: 0,
      sel_time: 0,
      ses_time: 0,
      mel_time: 0,
      mes_time: 0,
      helicopter_time: 0,
      gyroplane_time: 0,
      powered_lift_time: 0,
      glider_time: 0,
      balloon_time: 0,
      airship_time: 0,
      solo_time: 0,
      pic_time: 0,
      sic_time: 0,
      dual_time: 0,
      instructor_time: 0,
      xcountry_time: 0,
      night_time: 0,
      act_instrument_time: 0,
      sim_instrument_time: 0,
      full_flight_simulator_time: 0,
      flight_training_device_time: 0,
      aviation_training_device_time: 0,
      takeoffs_day: 0,
      takeoffs_night: 0,
      landings_day: 0,
      landings_night: 0,
      precision_approaches: 0,
      non_precision_approaches: 0,
      holding_patterns: 0,
    },
  );

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-slide-up dark:bg-zinc-900 dark:border-zinc-400">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-zinc-400">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Aircraft Type Totals
        </h2>
      </div>
      <div className="overflow-x-auto max-h-[calc(100vh-16rem)]">
        <table className="w-full text-center text-xs sm:text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-20">
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white text-left whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-zinc-800 z-30">
                Aircraft Type
              </th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">
                Total Hours
              </th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">
                Flights
              </th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">
                Days Since
              </th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">SEL</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">SES</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">MEL</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">MES</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Helicopter</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Gyroplane</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Powered Lift</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Glider</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Balloon</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Airship</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Solo</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">PIC</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">SIC</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Dual</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Instructor</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">X-Country</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Night</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Act. Instr</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Sim. Instr</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Full Sim</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">FTD</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">ATD</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Day TO</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Night TO</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Day Ldg</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Night Ldg</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Precision</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Non-Prec.</th>
              <th className="px-2 sm:px-3 py-2 font-semibold text-gray-600 dark:text-white whitespace-nowrap">Holding</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr
                key={s.aircraft_type}
                className="border-b border-gray-50 hover:bg-gray-50 dark:border-zinc-400 dark:hover:bg-zinc-700 logbook-row"
              >
                <td className="px-2 sm:px-3 py-2 text-left font-medium text-gray-900 dark:text-white whitespace-nowrap sticky left-0 bg-white dark:bg-zinc-900 z-10">
                  {s.aircraft_type}
                </td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.total_hours)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{s.flight_count}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">
                  {s.days_since_last_flight > 0 ? num(s.days_since_last_flight) : "—"}
                </td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.sel_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.ses_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.mel_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.mes_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.helicopter_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.gyroplane_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.powered_lift_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.glider_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.balloon_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.airship_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.solo_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.pic_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.sic_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.dual_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.instructor_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.xcountry_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.night_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.act_instrument_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.sim_instrument_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.full_flight_simulator_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.flight_training_device_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(s.aviation_training_device_time)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.takeoffs_day)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.takeoffs_night)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.landings_day)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.landings_night)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.precision_approaches)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.non_precision_approaches)}</td>
                <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(s.holding_patterns)}</td>
              </tr>
            ))}
          </tbody>
          {/* ── Totals row ── */}
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 dark:bg-zinc-800 dark:border-zinc-400 font-semibold sticky bottom-0 z-10">
              <td className="px-2 sm:px-3 py-2 text-left text-gray-900 dark:text-white whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-zinc-800 z-20">Totals</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.total_hours)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{totals.flight_count}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">—</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.sel_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.ses_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.mel_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.mes_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.helicopter_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.gyroplane_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.powered_lift_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.glider_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.balloon_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.airship_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.solo_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.pic_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.sic_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.dual_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.instructor_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.xcountry_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.night_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.act_instrument_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.sim_instrument_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.full_flight_simulator_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.flight_training_device_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{num(totals.aviation_training_device_time)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.takeoffs_day)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.takeoffs_night)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.landings_day)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.landings_night)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.precision_approaches)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.non_precision_approaches)}</td>
              <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">{nInt(totals.holding_patterns)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
