import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";
import {
  loadSettings,
  saveSettings,
  FA_CATEGORIES,
  resolveCategory,
  type FaCategoryMapping,
  type FaCategoryKey,
} from "../api/settings";

/** Aggregated row for one FAA category */
interface CatRow {
  key: FaCategoryKey;
  label: string;
  flights: Flight[];
  total_time: number;
  pic_time: number;
  sic_time: number;
  dual_time: number;
  instructor_time: number;
  xcountry_time: number;
  night_time: number;
  act_instrument_time: number;
  sim_instrument_time: number;
  sim_time: number;
  takeoffs_day: number;
  takeoffs_night: number;
  landings_day: number;
  landings_night: number;
}

function sum(flights: Flight[], field: (f: Flight) => number): number {
  return flights.reduce((acc, f) => acc + (field(f) || 0), 0);
}

function emptyRow(key: FaCategoryKey, label: string): CatRow {
  return {
    key,
    label,
    flights: [],
    total_time: 0,
    pic_time: 0,
    sic_time: 0,
    dual_time: 0,
    instructor_time: 0,
    xcountry_time: 0,
    night_time: 0,
    act_instrument_time: 0,
    sim_instrument_time: 0,
    sim_time: 0,
    takeoffs_day: 0,
    takeoffs_night: 0,
    landings_day: 0,
    landings_night: 0,
  };
}

function buildRows(
  flights: Flight[],
  mappings: FaCategoryMapping[],
): { rows: CatRow[]; uncategorized: Flight[] } {
  // Build rows per category
  const catMap = new Map<FaCategoryKey, Flight[]>();
  const uncategorized: Flight[] = [];

  for (const f of flights) {
    const cat = resolveCategory(f.aircraft_type, mappings);
    if (cat) {
      const arr = catMap.get(cat) ?? [];
      arr.push(f);
      catMap.set(cat, arr);
    } else {
      uncategorized.push(f);
    }
  }

  const rows: CatRow[] = FA_CATEGORIES.map((def) => {
    const catFlights = catMap.get(def.key) ?? [];
    // Use the DB time field for total_time when available; else sum total_time across flights
    let total_time: number;
    if (def.timeField) {
      total_time = sum(catFlights, (f) => f[def.timeField!]);
    } else {
      total_time = sum(catFlights, (f) => f.total_time);
    }

    return {
      key: def.key,
      label: def.label,
      flights: catFlights,
      total_time: Math.round(total_time * 10) / 10,
      pic_time: Math.round(sum(catFlights, (f) => f.pic_time) * 10) / 10,
      sic_time: Math.round(sum(catFlights, (f) => f.sic_time) * 10) / 10,
      dual_time: Math.round(sum(catFlights, (f) => f.dual_time) * 10) / 10,
      instructor_time: Math.round(sum(catFlights, (f) => f.instructor_time) * 10) / 10,
      xcountry_time: Math.round(sum(catFlights, (f) => f.xcountry_time) * 10) / 10,
      night_time: Math.round(sum(catFlights, (f) => f.night_time) * 10) / 10,
      act_instrument_time: Math.round(sum(catFlights, (f) => f.act_instrument_time) * 10) / 10,
      sim_instrument_time: Math.round(sum(catFlights, (f) => f.sim_instrument_time) * 10) / 10,
      sim_time: Math.round(sum(catFlights, (f) => f.sim_time) * 10) / 10,
      takeoffs_day: sum(catFlights, (f) => f.takeoffs_day),
      takeoffs_night: sum(catFlights, (f) => f.takeoffs_night),
      landings_day: sum(catFlights, (f) => f.landings_day),
      landings_night: sum(catFlights, (f) => f.landings_night),
    };
  });

  return { rows, uncategorized };
}

function mergeTotals(rows: CatRow[]): CatRow {
  const t = emptyRow("sel" as FaCategoryKey, "TOTAL");
  for (const r of rows) {
    t.total_time += r.total_time;
    t.pic_time += r.pic_time;
    t.sic_time += r.sic_time;
    t.dual_time += r.dual_time;
    t.instructor_time += r.instructor_time;
    t.xcountry_time += r.xcountry_time;
    t.night_time += r.night_time;
    t.act_instrument_time += r.act_instrument_time;
    t.sim_instrument_time += r.sim_instrument_time;
    t.sim_time += r.sim_time;
    t.takeoffs_day += r.takeoffs_day;
    t.takeoffs_night += r.takeoffs_night;
    t.landings_day += r.landings_day;
    t.landings_night += r.landings_night;
  }
  t.total_time = Math.round(t.total_time * 10) / 10;
  t.pic_time = Math.round(t.pic_time * 10) / 10;
  t.sic_time = Math.round(t.sic_time * 10) / 10;
  t.dual_time = Math.round(t.dual_time * 10) / 10;
  t.instructor_time = Math.round(t.instructor_time * 10) / 10;
  t.xcountry_time = Math.round(t.xcountry_time * 10) / 10;
  t.night_time = Math.round(t.night_time * 10) / 10;
  t.act_instrument_time = Math.round(t.act_instrument_time * 10) / 10;
  t.sim_instrument_time = Math.round(t.sim_instrument_time * 10) / 10;
  t.sim_time = Math.round(t.sim_time * 10) / 10;
  return t;
}

const COLUMN_HEADERS = [
  { key: "total_time",           label: "Total Time" },
  { key: "pic_time",             label: "PIC" },
  { key: "sic_time",             label: "SIC" },
  { key: "dual_time",            label: "Dual Received" },
  { key: "instructor_time",      label: "Instructor" },
  { key: "xcountry_time",        label: "Cross Country" },
  { key: "night_time",           label: "Night" },
  { key: "act_instrument_time",  label: "Actual Instrument" },
  { key: "sim_instrument_time",  label: "Simulated Instrument" },
  { key: "sim_time",             label: "Flight Simulator" },
  { key: "takeoffs_day",         label: "Day Takeoffs" },
  { key: "takeoffs_night",       label: "Night Takeoffs" },
  { key: "landings_day",         label: "Day Landings" },
  { key: "landings_night",       label: "Night Landings" },
] as const;

type ColKey = (typeof COLUMN_HEADERS)[number]["key"];

export default function FAA8710() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  // Category mappings persisted in localStorage
  const [mappings, setMappings] = useState<FaCategoryMapping[]>(() => loadSettings().faCategoryMappings);
  // Dropdown state — user picks an unmapped aircraft type and assigns a category
  const [selectedAircraft, setSelectedAircraft] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FaCategoryKey>("sel");

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  // Re-sync mappings when settings change externally
  useEffect(() => {
    const handler = () => setMappings(loadSettings().faCategoryMappings);
    window.addEventListener("settingsUpdated", handler);
    return () => window.removeEventListener("settingsUpdated", handler);
  }, []);

  const persistMappings = (updated: FaCategoryMapping[]) => {
    setMappings(updated);
    const s = loadSettings();
    s.faCategoryMappings = updated;
    saveSettings(s);
  };

  const { rows, uncategorized } = buildRows(flights, mappings);
  const totals = mergeTotals(rows);

  // Determine which aircraft types are NOT yet mapped — these populate the dropdown
  const mappedTypes = new Set<string>();
  for (const f of flights) {
    if (resolveCategory(f.aircraft_type, mappings)) {
      mappedTypes.add(f.aircraft_type);
    }
  }
  const allTypes = [...new Set(flights.map((f) => f.aircraft_type))].sort();
  const availableTypes = allTypes.filter((t) => !mappedTypes.has(t));

  const colValue = (row: CatRow, key: ColKey): number | string => {
    const v = row[key];
    if (typeof v === "number" && key.endsWith("_time")) {
      return v > 0 ? v.toFixed(1) : "";
    }
    return v || "";
  };

  const handleAddMapping = () => {
    if (!selectedAircraft) return;
    // Use the exact aircraft type as the pattern
    const updated = [...mappings, { pattern: selectedAircraft, category: selectedCategory }];
    persistMappings(updated);
    setSelectedAircraft("");
  };

  const handleRemoveMapping = (idx: number) => {
    const updated = mappings.filter((_, i) => i !== idx);
    persistMappings(updated);
  };

  // Show the form-friendly layout (responds to page visibility toggle via CSS)
  return (
    <div className="p-4 sm:p-8 max-w-[95%] mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">FAA 8710-1</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Record of Flight Time — totals are computed from your logbook entries based on the aircraft category mappings below.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg dark:bg-red-900 dark:text-red-300">
          Failed to load flights: {error}
        </div>
      )}

      {flights.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No flights logged yet. Add flights to see your FAA 8710 summary.</p>
        </div>
      )}

      {/* ─── Flight Time Table ─── */}
      {flights.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50 dark:bg-zinc-800 dark:border-zinc-600">
                  <th className="px-3 py-2.5 text-left text-sm font-semibold text-gray-600 dark:text-gray-300 min-w-[200px] sticky left-0 bg-gray-50 dark:bg-zinc-800 z-10">
                    Category / Class
                  </th>
                  {COLUMN_HEADERS.map((col) => (
                    <th key={col.key} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-200 sticky left-0 bg-white dark:bg-zinc-900 font-medium">
                      {row.label}
                    </td>
                    {COLUMN_HEADERS.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-center text-sm text-gray-700 dark:text-gray-300">
                        {colValue(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-100 dark:bg-zinc-700 dark:border-zinc-500 font-semibold">
                  <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-zinc-700">
                    TOTAL
                  </td>
                  {COLUMN_HEADERS.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-center text-sm text-gray-900 dark:text-white">
                      {colValue(totals, col.key)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* ─── Uncategorized warning ─── */}
          {uncategorized.length > 0 && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
              <strong>{uncategorized.length} flight{uncategorized.length > 1 ? "s" : ""} not categorized.</strong>{" "}
              Select an aircraft type below and map it to an FAA category.
            </div>
          )}
        </>
      )}

      {/* ─── Category Mapping Configuration ─── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Category Mappings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select an aircraft type from your logbook and assign it to an FAA category.
        </p>

        {/* Add new mapping — dropdown of unmapped aircraft types */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Aircraft type</label>
            <select
              value={selectedAircraft}
              onChange={(e) => setSelectedAircraft(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            >
              <option value="">-- Select aircraft type --</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              {availableTypes.length === 0 && flights.length > 0 && (
                <option value="" disabled>All aircraft types are mapped</option>
              )}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">FAA Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FaCategoryKey)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            >
              {FA_CATEGORIES.map((def) => (
                <option key={def.key} value={def.key}>{def.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddMapping}
            disabled={!selectedAircraft}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Mapping list */}
        {mappings.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No mappings configured yet. Select an aircraft type above to begin.</p>
        ) : (
          <div className="overflow-hidden border border-gray-200 dark:border-zinc-700 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Aircraft Type</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">FAA Category</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, idx) => {
                  const def = FA_CATEGORIES.find((d) => d.key === m.category);
                  return (
                    <tr key={idx} className="border-t border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-200 font-mono text-xs">{m.pattern}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{def?.label ?? m.category}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleRemoveMapping(idx)}
                          className="text-red-500 hover:text-red-700 transition-colors text-xs font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
