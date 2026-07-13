/**
 * SkyLog FAA 8710 Page
 *
 * Displays aggregated totals from the user's logbook in the FAA Form 8710
 * table format: aircraft categories as rows, time/count columns across the top.
 * Also provides a configuration section where the user can map
 * aircraft/simulator types to 8710 category labels.
 *
 * @module pages/FAA8710
 */

import { useEffect, useState, useMemo } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";

// ── Types ──────────────────────────────────────────────────────────────────

type FAA8710Category =
  | "sel" | "ses" | "mel" | "mes"
  | "helicopter" | "gyroplane" | "powered_lift"
  | "glider" | "balloon" | "airship"
  | "full_flight_simulator" | "flight_training_device" | "aviation_training_device";

const CATEGORY_LABELS: Record<FAA8710Category, string> = {
  sel: "Single Engine Land",
  ses: "Single Engine Sea",
  mel: "Multi Engine Land",
  mes: "Multi Engine Sea",
  helicopter: "Helicopter",
  gyroplane: "Gyroplane",
  powered_lift: "Powered Lift",
  glider: "Glider",
  balloon: "Balloon",
  airship: "Airship",
  full_flight_simulator: "Full Flight Simulator",
  flight_training_device: "Flight Training Device",
  aviation_training_device: "Aviation Training Device",
};

type AircraftTypeMappings = Record<string, string>;

// ── Data helpers ───────────────────────────────────────────────────────────

interface TableRow {
  label: string;
  total: number;
  dual: number;
  solo: number;
  pic: number;
  sic: number;
  xcDual: number;
  xcSolo: number;
  xcPic: number;
  xcSic: number;
  instrument: number;
  nightDual: number;
  nightTOLdg: number;
  nightPic: number;
  nightSic: number;
  nightTOLdgPic: number;
  nightTOLdgSic: number;
}

/** Row labels for the main aeronautical experience grid. */
const EXPERIENCE_ROWS: { label: string; catKeys: (keyof Flight)[] }[] = [
  { label: "Airplanes",              catKeys: ["sel_time", "ses_time", "mel_time", "mes_time"] },
  { label: "Rotorcraft",             catKeys: ["helicopter_time", "gyroplane_time"] },
  { label: "Powered Lift",          catKeys: ["powered_lift_time"] },
  { label: "Glider",                catKeys: ["glider_time"] },
  { label: "Lighter-than-Air",      catKeys: ["balloon_time", "airship_time"] },
  { label: "Full Flight Simulator", catKeys: ["full_flight_simulator_time"] },
  { label: "Flight Training Device",catKeys: ["flight_training_device_time"] },
  { label: "Aviation Training Device", catKeys: ["aviation_training_device_time"] },
];

function fmtHrs(n: number): string { return n.toFixed(1); }

function buildExperienceGrid(flights: Flight[], mappings: AircraftTypeMappings): TableRow[] {
  // Build reverse mapping: category value → list of aircraft types mapped to that category
  const categoryToTypes: Record<string, string[]> = {};
  for (const [aircraftType, categoryValue] of Object.entries(mappings)) {
    if (!categoryToTypes[categoryValue]) categoryToTypes[categoryValue] = [];
    categoryToTypes[categoryValue].push(aircraftType);
  }

  // Convert a flight field key like "sel_time" to the category value "sel"
  const catKeyToCategory = (key: keyof Flight): string =>
    String(key).replace(/_time$/, "");

  return EXPERIENCE_ROWS.map((r) => {
    // Collect all aircraft types that map to any sub-category of this row
    const rowCategories = r.catKeys.map(catKeyToCategory);
    const rowTypes = rowCategories.flatMap((c) => categoryToTypes[c] ?? []);
    const rowTypesSet = new Set(rowTypes);
    const filtered = flights.filter((f) => rowTypesSet.has(f.aircraft_type ?? ""));

    const sum = (k: keyof Flight): number =>
      filtered.reduce((a, f) => a + (Number(f[k]) || 0), 0);

    const co = (f: Flight, k: keyof Flight) => Number(f[k]) || 0;

    // Cross-country dual: hours where both xcountry_time AND dual_time > 0
    const xcDual = filtered.reduce((a, f) =>
      co(f, "xcountry_time") > 0 && co(f, "dual_time") > 0
        ? a + Math.min(co(f, "xcountry_time"), co(f, "dual_time"))
        : a, 0);

    // Cross-country solo: hours where both xcountry_time AND solo_time > 0
    const xcSolo = filtered.reduce((a, f) =>
      co(f, "xcountry_time") > 0 && co(f, "solo_time") > 0
        ? a + Math.min(co(f, "xcountry_time"), co(f, "solo_time"))
        : a, 0);

    // Cross-country PIC: hours where both xcountry_time AND pic_time > 0
    const xcPic = filtered.reduce((a, f) =>
      co(f, "xcountry_time") > 0 && co(f, "pic_time") > 0
        ? a + Math.min(co(f, "xcountry_time"), co(f, "pic_time"))
        : a, 0);

    // Cross-country SIC: hours where both xcountry_time AND sic_time > 0
    const xcSic = filtered.reduce((a, f) =>
      co(f, "xcountry_time") > 0 && co(f, "sic_time") > 0
        ? a + Math.min(co(f, "xcountry_time"), co(f, "sic_time"))
        : a, 0);

    // Instrument: actual + simulated instrument time
    const instrument = sum("act_instrument_time") + sum("sim_instrument_time");

    // Night dual: hours where both night_time AND dual_time > 0
    const nightDual = filtered.reduce((a, f) =>
      co(f, "night_time") > 0 && co(f, "dual_time") > 0
        ? a + Math.min(co(f, "night_time"), co(f, "dual_time"))
        : a, 0);

    // Night takeoffs + night landings (counts, not hours)
    const nightTOLdg = sum("takeoffs_night") + sum("landings_night");

    // Night PIC: hours where both night_time AND pic_time > 0
    const nightPic = filtered.reduce((a, f) =>
      co(f, "night_time") > 0 && co(f, "pic_time") > 0
        ? a + Math.min(co(f, "night_time"), co(f, "pic_time"))
        : a, 0);

    // Night SIC: hours where both night_time AND sic_time > 0
    const nightSic = filtered.reduce((a, f) =>
      co(f, "night_time") > 0 && co(f, "sic_time") > 0
        ? a + Math.min(co(f, "night_time"), co(f, "sic_time"))
        : a, 0);

    // Night takeoff/landing PIC: flights with night TOL and pic_time > 0
    const nightTOLdgPic = filtered.reduce((a, f) =>
      (co(f, "takeoffs_night") > 0 || co(f, "landings_night") > 0) && co(f, "pic_time") > 0
        ? a + Math.min(co(f, "pic_time"), co(f, "night_time") || 1)
        : a, 0);

    // Night takeoff/landing SIC: flights with night TOL and sic_time > 0
    const nightTOLdgSic = filtered.reduce((a, f) =>
      (co(f, "takeoffs_night") > 0 || co(f, "landings_night") > 0) && co(f, "sic_time") > 0
        ? a + Math.min(co(f, "sic_time"), co(f, "night_time") || 1)
        : a, 0);

    return {
      label: r.label,
      total: sum("total_time"),
      dual: sum("dual_time"),
      solo: sum("solo_time"),
      pic: sum("pic_time"),
      sic: sum("sic_time"),
      xcDual,
      xcSolo,
      xcPic,
      xcSic,
      instrument,
      nightDual,
      nightTOLdg,
      nightPic,
      nightSic,
      nightTOLdgPic,
      nightTOLdgSic,
    };
  });
}

interface CountRow {
  label: string;
  value: number;
}

function buildCountsGrid(flights: Flight[]): CountRow[] {
  const sum = (k: keyof Flight): number =>
    flights.reduce((a, f) => a + (Number(f[k]) || 0), 0);

  return [
    { label: "Day Takeoffs",              value: sum("takeoffs_day") },
    { label: "Night Takeoffs",            value: sum("takeoffs_night") },
    { label: "Day Landings",              value: sum("landings_day") },
    { label: "Night Landings",            value: sum("landings_night") },
    { label: "Precision Approaches",       value: sum("precision_approaches") },
    { label: "Non-Precision Approaches",   value: sum("non_precision_approaches") },
    { label: "Holding Patterns",           value: sum("holding_patterns") },
  ];
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Shared column-header row for the experience grid. */
function ExpHeader() {
  const th = "px-2 py-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 text-center border-r border-gray-200 dark:border-zinc-700";
  const first = "px-3 py-2 text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-white text-left sticky left-0 bg-gray-50 dark:bg-zinc-900 z-10";
  return (
    <tr className="bg-gray-50 dark:bg-zinc-900 border-b-2 border-gray-200 dark:border-zinc-600">
      <th className={first}>Aircraft / Device</th>
      <th className={th}>Total</th>
      <th className={th}>Instruction Received</th>
      <th className={th}>Solo</th>
      <th className={th}>PIC</th>
      <th className={th}>SIC</th>
      <th className={th}>XC Instruction Received</th>
      <th className={th}>XC Solo</th>
      <th className={th}>XC PIC</th>
      <th className={th}>XC SIC</th>
      <th className={th}>Instrument</th>
      <th className={th}>Night Instruction</th>
      <th className={th}>Night T/O & Ldg</th>
      <th className={th}>Night PIC</th>
      <th className={th}>Night SIC</th>
      <th className={th}>Night T/O & Ldg PIC</th>
      <th className={th}>Night T/O & Ldg SIC</th>
    </tr>
  );
}

function ExpRow({ row }: { row: TableRow }) {
  const td = "px-2 py-2 text-[11px] sm:text-sm text-center border-r border-gray-100 dark:border-zinc-700 tabular-nums";
  const lbl = "px-3 py-2 text-[11px] sm:text-sm font-medium text-gray-900 dark:text-white text-left sticky left-0 bg-white dark:bg-zinc-800 z-10 border-r border-gray-100 dark:border-zinc-700 whitespace-nowrap";
  return (
    <tr className="border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
      <td className={lbl}>{row.label}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.total)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.dual)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.solo)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.pic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.sic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.xcDual)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.xcSolo)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.xcPic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.xcSic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.instrument)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.nightDual)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{row.nightTOLdg.toFixed(0)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.nightPic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.nightSic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.nightTOLdgPic)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.nightTOLdgSic)}</td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function FAA8710() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [mappings, setMappings] = useState<AircraftTypeMappings>({});
  const [mappingsLoaded, setMappingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("mappings");

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api.getFAA8710Mappings()
      .then((m) => { setMappings(m); setMappingsLoaded(true); })
      .catch(() => setMappingsLoaded(true));
  }, []);

  const experienceRows = useMemo(() => buildExperienceGrid(flights, mappings), [flights, mappings]);
  const countRows = useMemo(() => buildCountsGrid(flights), [flights]);

  const uniqueTypes = useMemo(() => {
    const seen = new Set<string>();
    flights.forEach((f) => { const t = f.aircraft_type?.trim(); if (t) seen.add(t); });
    return Array.from(seen).sort();
  }, [flights]);

  const saveMappings = async () => {
    setSaving(true);
    try { await api.saveFAA8710Mappings(mappings); }
    catch (e) { alert(`Failed to save mappings: ${e instanceof Error ? e.message : "Unknown"}`); }
    finally { setSaving(false); }
  };

  const setMapping = (aircraftType: string, category: FAA8710Category | "") => {
    setMappings((prev) => {
      const next = { ...prev };
      if (category === "") delete next[aircraftType];
      else next[aircraftType] = category;
      return next;
    });
  };

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

  // ── Empty state ──
  if (flights.length === 0) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="max-w-md mx-auto py-16">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">No flights logged yet</h2>
          <p className="text-gray-500 mb-6 dark:text-white">Log some flights to see your FAA 8710 totals.</p>
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

  // ── Main render ──
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
        FAA 8710 — Aeronautical Experience
      </h1>

      {/* ═══ Experience Grid ═══ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8 dark:bg-zinc-800 dark:border-zinc-600">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-600">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-white">
            Flight Time by Aircraft / Device
          </h2>
          
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <ExpHeader />
            </thead>
            <tbody>
              {experienceRows.map((row) => (
                <ExpRow key={row.label} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Takeoffs / Landings / Approaches ═══ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8 dark:bg-zinc-800 dark:border-zinc-600">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-600">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-white">
            Takeoffs, Landings & Approaches
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-zinc-600">
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white w-2/3">Event</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white w-1/3 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {countRows.map((r) => (
                <tr key={r.label} className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors">
                  <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-700 dark:text-white">{r.label}</td>
                  <td className="px-4 sm:px-6 py-2.5 text-sm font-semibold text-gray-900 dark:text-white text-right tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Aircraft Type Mappings ═══ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden dark:bg-zinc-800 dark:border-zinc-600">
        <button
          onClick={() => setExpandedSection(expandedSection === "mappings" ? null : "mappings")}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-white">
            Aircraft / Simulator Type Mapping
          </h2>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === "mappings" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSection === "mappings" && (
          <div className="p-4 sm:p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Map each aircraft or simulator type in your logbook to its 8710 category.
              Changes are saved per-user and persist across sessions.
            </p>

            {!mappingsLoaded ? (
              <div className="text-center py-8 text-gray-400">Loading mappings…</div>
            ) : uniqueTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No aircraft types found in your logbook.</div>
            ) : (
              <>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-gray-200 dark:border-zinc-600">
                        <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-white w-2/5">Aircraft Type</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-white w-3/5">8710 Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                      {uniqueTypes.map((t) => (
                        <tr key={t} className="hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
                          <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white font-medium">{t}</td>
                          <td className="px-3 py-2.5">
                            <select
                              value={mappings[t] ?? ""}
                              onChange={(e) => setMapping(t, e.target.value as FAA8710Category | "")}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
                            >
                              <option value="">— Unmapped —</option>
                              {(Object.keys(CATEGORY_LABELS) as FAA8710Category[]).map((cat) => (
                                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={saveMappings} disabled={saving} className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-primary">
                    {saving ? "Saving…" : (<><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Save Mappings</>)}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
