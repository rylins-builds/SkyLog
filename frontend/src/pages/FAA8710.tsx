import { Fragment, useEffect, useState } from "react";
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

/* ─── Type definitions ─── */

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

interface TrainingRow {
  key: string;
  label: string;
  sim_time: number;
}

/* ─── FAA 8710-1 form constants ─── */

const COLUMN_HEADERS = [
  { key: "total_time", label: "Total Time" },
  { key: "pic_time", label: "PIC" },
  { key: "sic_time", label: "SIC" },
  { key: "dual_time", label: "Dual Received" },
  { key: "instructor_time", label: "Instructor" },
  { key: "xcountry_time", label: "Cross Country" },
  { key: "night_time", label: "Night" },
  { key: "act_instrument_time", label: "Actual Instrument" },
  { key: "sim_instrument_time", label: "Simulated Instrument" },
  { key: "sim_time", label: "Flight Simulator" },
  { key: "takeoffs_day", label: "Day Takeoffs" },
  { key: "takeoffs_night", label: "Night Takeoffs" },
  { key: "landings_day", label: "Day Landings" },
  { key: "landings_night", label: "Night Landings" },
] as const;

type ColKey = (typeof COLUMN_HEADERS)[number]["key"];

/** Category groups matching the FAA 8710-1 layout */
const CATEGORY_GROUPS: { label: string; keys: FaCategoryKey[] }[] = [
  { label: "AIRPLANE", keys: ["sel", "ses", "mel", "mes"] },
  { label: "ROTORCRAFT", keys: ["helicopter", "gyroplane"] },
  { label: "POWERED-LIFT", keys: ["powered_lift"] },
  { label: "GLIDER", keys: ["glider"] },
  { label: "LIGHTER-THAN-AIR", keys: ["lighter_than_air"] },
];

/** Training device rows (always show with zero values — user fills manually on the form) */
const TRAINING_DEVICES: { key: string; label: string }[] = [
  { key: "ffs", label: "Full Flight Simulator (FFS)" },
  { key: "ftd", label: "Flight Training Device (FTD)" },
  { key: "atd", label: "Advanced Training Device (ATD)" },
];

/* ─── Greying logic matching the real 8710-1 form ─── */

type RowKind = "category" | "training" | "cat_total" | "train_total" | "grand_total";

function isGreyed(kind: RowKind, colKey: ColKey): boolean {
  if (kind === "category" || kind === "cat_total") {
    // Category and cat-total rows: the "Flight Simulator" column is not applicable → greyed
    return colKey === "sim_time";
  }
  if (kind === "training" || kind === "train_total") {
    // Training-device rows: ONLY the "Flight Simulator" column is applicable
    return colKey !== "sim_time";
  }
  // grand_total — all columns are active
  return false;
}

/* ─── Helpers ─── */

function sum(flights: Flight[], field: (f: Flight) => number): number {
  return flights.reduce((acc, f) => acc + (field(f) || 0), 0);
}

function emptyRow(key: FaCategoryKey, label: string): CatRow {
  return {
    key, label, flights: [],
    total_time: 0, pic_time: 0, sic_time: 0, dual_time: 0, instructor_time: 0,
    xcountry_time: 0, night_time: 0, act_instrument_time: 0, sim_instrument_time: 0,
    sim_time: 0, takeoffs_day: 0, takeoffs_night: 0, landings_day: 0, landings_night: 0,
  };
}

function buildCategoryRows(
  flights: Flight[],
  mappings: FaCategoryMapping[],
): { rows: Map<FaCategoryKey, CatRow>; uncategorized: Flight[] } {
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

  const rows = new Map<FaCategoryKey, CatRow>();

  for (const def of FA_CATEGORIES) {
    const catFlights = catMap.get(def.key) ?? [];
    let total_time: number;
    if (def.timeField) {
      total_time = sum(catFlights, (f) => f[def.timeField!]);
    } else {
      total_time = sum(catFlights, (f) => f.total_time);
    }

    rows.set(def.key, {
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
    });
  }

  return { rows, uncategorized };
}

function buildTrainingRows(): Map<string, TrainingRow> {
  const rows = new Map<string, TrainingRow>();
  for (const td of TRAINING_DEVICES) {
    rows.set(td.key, { key: td.key, label: td.label, sim_time: 0 });
  }
  return rows;
}

function mergeCategoryTotal(rows: Map<FaCategoryKey, CatRow>): CatRow {
  const t = emptyRow("sel" as FaCategoryKey, "TOTAL");
  for (const r of rows.values()) {
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

function mergeTrainingTotal(trainingRows: Map<string, TrainingRow>): TrainingRow {
  let sim = 0;
  for (const r of trainingRows.values()) {
    sim += r.sim_time;
  }
  return {
    key: "train_total",
    label: "TOTAL (training devices)",
    sim_time: Math.round(sim * 10) / 10,
  };
}

/** Format a numeric cell value — time fields show 1 decimal, int fields show as-is */
function fmtCell(value: number, isTime: boolean): string {
  if (value === 0) return "";
  return isTime ? value.toFixed(1) : String(value);
}

/* ─── Main component ─── */

export default function FAA8710() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [mappings, setMappings] = useState<FaCategoryMapping[]>(() => loadSettings().faCategoryMappings);
  const [selectedAircraft, setSelectedAircraft] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FaCategoryKey>("sel");

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

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

  // ── Computed data ──

  const { rows: catRows, uncategorized } = buildCategoryRows(flights, mappings);
  const catTotal = mergeCategoryTotal(catRows);
  const trainingRows = buildTrainingRows();
  const trainTotal = mergeTrainingTotal(trainingRows);

  // Grand total: copy catTotal but replace sim_time with the total from all flights
  // (the 8710 has a single "Flight Simulator" column that spans all rows)
  const totalSimForAll = Math.round(sum(flights, (f) => f.sim_time) * 10) / 10;
  const grandTotal: CatRow = {
    ...catTotal,
    key: "grand_total" as FaCategoryKey,
    label: "GRAND TOTAL",
    sim_time: totalSimForAll,
  };

  // Determine available (unmapped) aircraft types for the mapping dropdown
  const mappedTypes = new Set<string>();
  for (const f of flights) {
    if (resolveCategory(f.aircraft_type, mappings)) {
      mappedTypes.add(f.aircraft_type);
    }
  }
  const allTypes = [...new Set(flights.map((f) => f.aircraft_type))].sort();
  const availableTypes = allTypes.filter((t) => !mappedTypes.has(t));

  const handleAddMapping = () => {
    if (!selectedAircraft) return;
    const updated = [...mappings, { pattern: selectedAircraft, category: selectedCategory }];
    persistMappings(updated);
    setSelectedAircraft("");
  };

  const handleRemoveMapping = (idx: number) => {
    persistMappings(mappings.filter((_, i) => i !== idx));
  };

  // ── Right-panel data ──

  const gliderRow = catRows.get("glider");
  const ltaRow = catRows.get("lighter_than_air");

  return (
    <div className="p-4 sm:p-8 max-w-[95%] mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">FAA 8710-1</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Record of Pilot Time (Block B) — computed from your logbook.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg dark:bg-red-900 dark:text-red-300">
          Failed to load flights: {error}
        </div>
      )}

      {flights.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No flights logged yet.</p>
        </div>
      )}

      {flights.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ══════════════════  LEFT – Main Flight-Time Table  ══════════════════ */}
          <div className="flex-1 min-w-0 overflow-x-auto bg-white rounded-xl shadow-md border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-100 dark:bg-zinc-800 dark:border-zinc-600">
                  <th className="px-2 sm:px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 min-w-[180px] sm:min-w-[220px] sticky left-0 bg-gray-100 dark:bg-zinc-800 z-10">
                    Category / Class
                  </th>
                  {COLUMN_HEADERS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-1.5 sm:px-2 py-2.5 text-center text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                        col.key === "sim_time"
                          ? "text-gray-500 dark:text-gray-400"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ─── Category / Class section rows ─── */}
                {CATEGORY_GROUPS.map((group) => (
                  <Fragment key={group.label}>
                    {/* Group header row */}
                    <tr>
                      <td
                        colSpan={COLUMN_HEADERS.length + 1}
                        className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-700"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {/* Individual category rows */}
                    {group.keys.map((k) => {
                      const row = catRows.get(k);
                      if (!row) return null;
                      return (
                        <tr
                          key={k}
                          className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <td className="px-2 sm:px-3 py-2 text-sm text-gray-900 dark:text-gray-200 sticky left-0 bg-white dark:bg-zinc-900 font-medium">
                            {row.label}
                          </td>
                          {COLUMN_HEADERS.map((col) => (
                            <td
                              key={col.key}
                              className={`px-1.5 sm:px-2 py-2 text-center text-sm ${
                                isGreyed("category", col.key)
                                  ? "text-gray-300 dark:text-zinc-600 bg-gray-50 dark:bg-zinc-800/30"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {isGreyed("category", col.key)
                                ? ""
                                : fmtCell(row[col.key] as number, col.key.endsWith("_time"))}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}

                {/* ─── Training device rows ─── */}
                <tr>
                  <td
                    colSpan={COLUMN_HEADERS.length + 1}
                    className="px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-zinc-800/60 border-b border-t-2 border-gray-300 dark:border-zinc-600"
                  >
                    TRAINING DEVICES
                  </td>
                </tr>
                {TRAINING_DEVICES.map((td) => (
                  <tr
                    key={td.key}
                    className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <td className="px-2 sm:px-3 py-2 text-sm text-gray-900 dark:text-gray-200 sticky left-0 bg-white dark:bg-zinc-900 font-medium">
                      {td.label}
                    </td>
                    {COLUMN_HEADERS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-1.5 sm:px-2 py-2 text-center text-sm ${
                          isGreyed("training", col.key)
                            ? "text-gray-300 dark:text-zinc-600 bg-gray-50 dark:bg-zinc-800/30"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {isGreyed("training", col.key) ? "" : "0.0"}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* ─── TOTAL (category) row ─── */}
                <tr className="border-t-2 border-gray-300 bg-gray-100 dark:bg-zinc-700 dark:border-zinc-500 font-semibold">
                  <td className="px-2 sm:px-3 py-2.5 text-sm text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-zinc-700">
                    {catTotal.label}
                  </td>
                  {COLUMN_HEADERS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-1.5 sm:px-2 py-2.5 text-center text-sm ${
                        isGreyed("cat_total", col.key)
                          ? "text-gray-300 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-700"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {isGreyed("cat_total", col.key)
                        ? ""
                        : fmtCell(catTotal[col.key] as number, col.key.endsWith("_time"))}
                    </td>
                  ))}
                </tr>

                {/* ─── TOTAL (training devices) row ─── */}
                <tr className="border-t border-gray-200 bg-gray-50 dark:bg-zinc-700/70 dark:border-zinc-500 font-semibold">
                  <td className="px-2 sm:px-3 py-2.5 text-sm text-gray-900 dark:text-white sticky left-0 bg-gray-50 dark:bg-zinc-700/70">
                    {trainTotal.label}
                  </td>
                  {COLUMN_HEADERS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-1.5 sm:px-2 py-2.5 text-center text-sm ${
                        isGreyed("train_total", col.key)
                          ? "text-gray-300 dark:text-zinc-600 bg-gray-50 dark:bg-zinc-700/70"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {isGreyed("train_total", col.key)
                        ? ""
                        : fmtCell(trainTotal.sim_time, true)}
                    </td>
                  ))}
                </tr>

                {/* ─── GRAND TOTAL row ─── */}
                <tr className="border-t-2 border-gray-900 bg-gray-200 dark:bg-zinc-600 dark:border-zinc-400 font-bold">
                  <td className="px-2 sm:px-3 py-2.5 text-sm text-gray-900 dark:text-white sticky left-0 bg-gray-200 dark:bg-zinc-600">
                    {grandTotal.label}
                  </td>
                  {COLUMN_HEADERS.map((col) => (
                    <td
                      key={col.key}
                      className="px-1.5 sm:px-2 py-2.5 text-center text-sm text-gray-900 dark:text-white"
                    >
                      {fmtCell(grandTotal[col.key] as number, col.key.endsWith("_time"))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══════════════════  RIGHT – Number of / Class Totals  ══════════════════ */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            {/* ── "Number of" box ── */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 overflow-hidden">
              <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Number of
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Glider */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Glider</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Total Time:</span>
                      <span className="ml-1 text-gray-900 dark:text-white font-medium">
                        {gliderRow ? fmtCell(gliderRow.total_time, true) : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">PIC:</span>
                      <span className="ml-1 text-gray-900 dark:text-white font-medium">
                        {gliderRow ? fmtCell(gliderRow.pic_time, true) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Lighter-Than-Air */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Lighter-Than-Air</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Total Time:</span>
                      <span className="ml-1 text-gray-900 dark:text-white font-medium">
                        {ltaRow ? fmtCell(ltaRow.total_time, true) : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">PIC:</span>
                      <span className="ml-1 text-gray-900 dark:text-white font-medium">
                        {ltaRow ? fmtCell(ltaRow.pic_time, true) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Class Totals box ── */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 overflow-hidden">
              <div className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Class Totals
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Airplane */}
                <ClassTotalRow
                  label="Airplane"
                  total={mergeGroupTotal(catRows, ["sel", "ses", "mel", "mes"], "total_time")}
                  pic={mergeGroupTotal(catRows, ["sel", "ses", "mel", "mes"], "pic_time")}
                />
                {/* Rotorcraft */}
                <ClassTotalRow
                  label="Rotorcraft"
                  total={mergeGroupTotal(catRows, ["helicopter", "gyroplane"], "total_time")}
                  pic={mergeGroupTotal(catRows, ["helicopter", "gyroplane"], "pic_time")}
                />
                {/* Powered-Lift */}
                <ClassTotalRow
                  label="Powered-Lift"
                  total={mergeGroupTotal(catRows, ["powered_lift"], "total_time")}
                  pic={mergeGroupTotal(catRows, ["powered_lift"], "pic_time")}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Uncategorized warning ─── */}
      {uncategorized.length > 0 && (
        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
          <strong>{uncategorized.length} flight{uncategorized.length > 1 ? "s" : ""} not categorized.</strong>{" "}
          Select an aircraft type below and map it to an FAA category.
        </div>
      )}

      {/* ─── Category Mapping Configuration ─── */}
      <div className="mt-6 bg-white rounded-xl shadow-md border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Category Mappings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select an aircraft type from your logbook and assign it to an FAA category.
        </p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-0">
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
          <div className="flex-1 min-w-0">
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

        {mappings.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No mappings configured yet.</p>
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

/* ─── Sub-component: merged class total row for the right panel ─── */

function ClassTotalRow({ label, total, pic }: { label: string; total: number; pic: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Total Time:</span>
          <span className="ml-1 text-gray-900 dark:text-white font-medium">
            {total > 0 ? total.toFixed(1) : "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">PIC:</span>
          <span className="ml-1 text-gray-900 dark:text-white font-medium">
            {pic > 0 ? pic.toFixed(1) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Sum a field across a list of category keys */
function mergeGroupTotal(
  rows: Map<FaCategoryKey, CatRow>,
  keys: FaCategoryKey[],
  field: "total_time" | "pic_time",
): number {
  let total = 0;
  for (const k of keys) {
    const r = rows.get(k);
    if (r) total += r[field];
  }
  return Math.round(total * 10) / 10;
}
