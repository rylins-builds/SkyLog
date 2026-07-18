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

/** Individual 8710 categories shown in the mapping dropdown. */
type MappingCategory =
  | "sel" | "ses" | "mel" | "mes"
  | "helicopter" | "gyroplane"
  | "powered_lift"
  | "glider"
  | "balloon" | "airship"
  | "full_flight_simulator" | "flight_training_device" | "aviation_training_device";

const MAPPING_LABELS: Record<MappingCategory, string> = {
  sel: "Single-Engine Land",
  ses: "Single-Engine Sea",
  mel: "Multi-Engine Land",
  mes: "Multi-Engine Sea",
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

type GreyedOutColumn = "solo" | "pic" | "sic" | "xcDual" | "xcSolo" | "xcPic" | "xcSic"
  | "nightDual" | "nightTOLdg" | "nightPic" | "nightSic" | "nightTOLdgPic" | "nightTOLdgSic";

interface TableRow {
  label: string;
  greyedOutColumns: Set<GreyedOutColumn>;
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
  // Build reverse mapping: sub-category → list of aircraft types
  // Each mapping value is already a direct sub-category key (e.g. "ses", "helicopter")
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

    // Build greyedOutColumns: different rules per category
    const isFullFlightSimulator = r.catKeys.some((k) =>
      String(k).startsWith("full_flight_simulator")
    );
    const isFlightTrainingDevice = r.catKeys.some((k) =>
      String(k).startsWith("flight_training_device")
    );
    const isAviationTrainingDevice = r.catKeys.some((k) =>
      String(k).startsWith("aviation_training_device")
    );
    const isGlider = r.label === "Glider";

    const greyedOutColumns = new Set<GreyedOutColumn>();
    if (isGlider) {
      // Glider: only XC PIC, XC SIC, and all night columns greyed out
      greyedOutColumns.add("xcPic");
      greyedOutColumns.add("xcSic");
      greyedOutColumns.add("nightDual");
      greyedOutColumns.add("nightTOLdg");
      greyedOutColumns.add("nightPic");
      greyedOutColumns.add("nightSic");
      greyedOutColumns.add("nightTOLdgPic");
      greyedOutColumns.add("nightTOLdgSic");
    } else if (isFullFlightSimulator) {
      // Full Flight Simulator: Solo through XC SIC greyed out
      greyedOutColumns.add("solo");
      greyedOutColumns.add("pic");
      greyedOutColumns.add("sic");
      greyedOutColumns.add("xcDual");
      greyedOutColumns.add("xcSolo");
      greyedOutColumns.add("xcPic");
      greyedOutColumns.add("xcSic");
    } else if (isFlightTrainingDevice) {
      // Flight Training Device: Solo through XC SIC + Night T/O & Ldg columns greyed out
      greyedOutColumns.add("solo");
      greyedOutColumns.add("pic");
      greyedOutColumns.add("sic");
      greyedOutColumns.add("xcDual");
      greyedOutColumns.add("xcSolo");
      greyedOutColumns.add("xcPic");
      greyedOutColumns.add("xcSic");
      greyedOutColumns.add("nightTOLdg");
      greyedOutColumns.add("nightTOLdgPic");
      greyedOutColumns.add("nightTOLdgSic");
    } else if (isAviationTrainingDevice) {
      // Aviation Training Device: Solo through XC SIC + all night columns greyed out
      greyedOutColumns.add("solo");
      greyedOutColumns.add("pic");
      greyedOutColumns.add("sic");
      greyedOutColumns.add("xcDual");
      greyedOutColumns.add("xcSolo");
      greyedOutColumns.add("xcPic");
      greyedOutColumns.add("xcSic");
      greyedOutColumns.add("nightDual");
      greyedOutColumns.add("nightTOLdg");
      greyedOutColumns.add("nightPic");
      greyedOutColumns.add("nightSic");
      greyedOutColumns.add("nightTOLdgPic");
      greyedOutColumns.add("nightTOLdgSic");
    }

    return {
      label: r.label,
      greyedOutColumns,
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

interface LaunchRow {
  label: string;
  picFlights: number;
  dualFlights: number;
  totalFlights: number;
  aeroTows: number;
  groundLaunches: number;
  poweredLaunches: number;
}

function buildLaunchGrid(flights: Flight[], mappings: AircraftTypeMappings): LaunchRow[] {
  // Build reverse mapping: sub-category → list of aircraft types
  const categoryToTypes: Record<string, string[]> = {};
  for (const [aircraftType, categoryValue] of Object.entries(mappings)) {
    if (!categoryToTypes[categoryValue]) categoryToTypes[categoryValue] = [];
    categoryToTypes[categoryValue].push(aircraftType);
  }

  const catKeyToCategory = (key: keyof Flight): string =>
    String(key).replace(/_time$/, "");

  const rows: { label: string; catKeys: (keyof Flight)[] }[] = [
    { label: "Glider",           catKeys: ["glider_time"] },
    { label: "Lighter-than-Air", catKeys: ["balloon_time", "airship_time"] },
  ];

  return rows.map((r) => {
    const rowCategories = r.catKeys.map(catKeyToCategory);
    const rowTypes = rowCategories.flatMap((c) => categoryToTypes[c] ?? []);
    const rowTypesSet = new Set(rowTypes);
    const filtered = flights.filter((f) => rowTypesSet.has(f.aircraft_type ?? ""));

    const countLaunch = (type: string): number =>
      filtered.filter((f) => f.launch_type === type).length;

    const co = (f: Flight, k: keyof Flight) => Number(f[k]) || 0;

    return {
      label: r.label,
      picFlights: filtered.filter((f) => co(f, "pic_time") > 0).length,
      dualFlights: filtered.filter((f) => co(f, "dual_time") > 0).length,
      totalFlights: filtered.length,
      aeroTows: countLaunch("aero_tow"),
      groundLaunches: countLaunch("ground_launch"),
      poweredLaunches: countLaunch("powered_launch"),
    };
  });
}

interface ClassSubRow {
  label: string;
  values: number[];
}

interface ClassTotalsGroup {
  groupLabel: string;
  subLabels: string[];
  subCatKeys: (keyof Flight)[];
  rows: ClassSubRow[];
}

function buildClassTotals(flights: Flight[], mappings: AircraftTypeMappings): ClassTotalsGroup[] {
  const categoryToTypes: Record<string, string[]> = {};
  for (const [aircraftType, categoryValue] of Object.entries(mappings)) {
    if (!categoryToTypes[categoryValue]) categoryToTypes[categoryValue] = [];
    categoryToTypes[categoryValue].push(aircraftType);
  }

  const filterByCat = (cat: string): Flight[] => {
    const types = categoryToTypes[cat] ?? [];
    const typesSet = new Set(types);
    return flights.filter((f) => typesSet.has(f.aircraft_type ?? ""));
  };

  type FieldKey = "pic_time" | "sic_time" | "dual_time" | "total_time";

  const sumField = (filtered: Flight[], field: FieldKey): number =>
    filtered.reduce((a, f) => a + (Number(f[field]) || 0), 0);

  interface CategoryDef {
    groupLabel: string;
    subLabels: string[];
    subCatKeys: readonly string[];
    rowDefs: { label: string; fields: FieldKey[] }[];
  }

  const categories: CategoryDef[] = [
    {
      groupLabel: "Airplane",
      subLabels: ["SEL", "MEL", "SES", "MES"],
      subCatKeys: ["sel", "mel", "ses", "mes"] as const,
      rowDefs: [
        { label: "PIC", fields: ["pic_time", "pic_time", "pic_time", "pic_time"] },
        { label: "SIC", fields: ["sic_time", "sic_time", "sic_time", "sic_time"] },
        { label: "Instruction Received", fields: ["dual_time", "dual_time", "dual_time", "dual_time"] },
      ],
    },
    {
      groupLabel: "Rotorcraft",
      subLabels: ["Helicopter", "Gyroplane"],
      subCatKeys: ["helicopter", "gyroplane"] as const,
      rowDefs: [
        { label: "Total Hours", fields: ["total_time", "total_time"] },
      ],
    },
    {
      groupLabel: "Lighter-than-Air",
      subLabels: ["Balloon", "Airship"],
      subCatKeys: ["balloon", "airship"] as const,
      rowDefs: [
        { label: "Total Hours", fields: ["total_time", "total_time"] },
      ],
    },
  ];

  return categories.map((cat) => {
    const subRows: ClassSubRow[] = [];

    for (const rowDef of cat.rowDefs) {
      const values: number[] = [];
      for (let i = 0; i < cat.subCatKeys.length; i++) {
        const subCat = cat.subCatKeys[i];
        const filtered = filterByCat(subCat);
        values.push(sumField(filtered, rowDef.fields[i]));
      }
      subRows.push({ label: rowDef.label, values });
    }

    return {
      groupLabel: cat.groupLabel,
      subLabels: cat.subLabels,
      subCatKeys: cat.subCatKeys as unknown as (keyof Flight)[],
      rows: subRows,
    };
  });
}

// ── Simulated Flight Totals ────────────────────────────────────────────────

interface SimFlightRow {
  label: string;
  se: number;
  me: number;
  helicopter: number;
}

function buildSimFlightTotals(flights: Flight[], mappings: AircraftTypeMappings): SimFlightRow[] {
  const categoryToTypes: Record<string, string[]> = {};
  for (const [aircraftType, categoryValue] of Object.entries(mappings)) {
    if (!categoryToTypes[categoryValue]) categoryToTypes[categoryValue] = [];
    categoryToTypes[categoryValue].push(aircraftType);
  }

  const filterByCat = (cat: string): Flight[] => {
    const types = categoryToTypes[cat] ?? [];
    const typesSet = new Set(types);
    return flights.filter((f) => typesSet.has(f.aircraft_type ?? ""));
  };

  const sumField = (filtered: Flight[], field: keyof Flight): number =>
    filtered.reduce((a, f) => a + (Number(f[field]) || 0), 0);

  const categories: { label: string; catKey: string }[] = [
    { label: "FFS", catKey: "full_flight_simulator" },
    { label: "FTD", catKey: "flight_training_device" },
    { label: "ATD", catKey: "aviation_training_device" },
  ];

  return categories.map((c) => {
    const filtered = filterByCat(c.catKey);
    return {
      label: c.label,
      se: sumField(filtered, "sel_time") + sumField(filtered, "ses_time"),
      me: sumField(filtered, "mel_time") + sumField(filtered, "mes_time"),
      helicopter: sumField(filtered, "helicopter_time"),
    };
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Shared column-header row for the experience grid. */
function ExpHeader() {
  const th = "px-2 py-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 text-center border-r border-gray-200 dark:border-zinc-400";
  const first = "px-3 py-2 text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-white text-left sticky left-0 bg-gray-50 dark:bg-zinc-900 z-10";
  return (
    <tr className="bg-gray-50 dark:bg-zinc-900 border-b-2 border-gray-200 dark:border-zinc-400">
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
  const td = "px-2 py-2 text-[11px] sm:text-sm text-center border-r border-gray-100 dark:border-zinc-400 tabular-nums";
  const lbl = "px-3 py-2 text-[11px] sm:text-sm font-medium text-gray-900 dark:text-white text-left sticky left-0 bg-white dark:bg-zinc-800 z-10 border-r border-gray-100 dark:border-zinc-400 whitespace-nowrap";
  const tdDisabled = `${td} text-gray-300 dark:text-gray-600`;

  const greyed = (col: GreyedOutColumn) => row.greyedOutColumns.has(col);
  const cell = (col: GreyedOutColumn, val: string | number) => (
    <td className={greyed(col) ? tdDisabled : `${td} text-gray-900 dark:text-white`}>
      {greyed(col) ? "—" : val}
    </td>
  );

  return (
    <tr className="border-b border-gray-100 dark:border-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors">
      <td className={lbl}>{row.label}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.total)}</td>
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.dual)}</td>
      {cell("solo", fmtHrs(row.solo))}
      {cell("pic", fmtHrs(row.pic))}
      {cell("sic", fmtHrs(row.sic))}
      {cell("xcDual", fmtHrs(row.xcDual))}
      {cell("xcSolo", fmtHrs(row.xcSolo))}
      {cell("xcPic", fmtHrs(row.xcPic))}
      {cell("xcSic", fmtHrs(row.xcSic))}
      <td className={`${td} text-gray-900 dark:text-white`}>{fmtHrs(row.instrument)}</td>
      {cell("nightDual", fmtHrs(row.nightDual))}
      {cell("nightTOLdg", row.nightTOLdg.toFixed(0))}
      {cell("nightPic", fmtHrs(row.nightPic))}
      {cell("nightSic", fmtHrs(row.nightSic))}
      {cell("nightTOLdgPic", fmtHrs(row.nightTOLdgPic))}
      {cell("nightTOLdgSic", fmtHrs(row.nightTOLdgSic))}
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
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
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
  const launchRows = useMemo(() => buildLaunchGrid(flights, mappings), [flights, mappings]);
  const classTotals = useMemo(() => buildClassTotals(flights, mappings), [flights, mappings]);
  const simFlightRows = useMemo(() => buildSimFlightTotals(flights, mappings), [flights, mappings]);

  const uniqueTypes = useMemo(() => {
    const seen = new Set<string>();
    flights.forEach((f) => { const t = f.aircraft_type?.trim(); if (t) seen.add(t); });
    return Array.from(seen).sort();
  }, [flights]);

  const saveMappings = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api.saveFAA8710Mappings(mappings);
      setSaveStatus({ type: "success", message: "Mappings saved successfully." });
    } catch (e) {
      setSaveStatus({ type: "error", message: `Failed to save mappings: ${e instanceof Error ? e.message : "Unknown"}` });
    } finally {
      setSaving(false);
    }
  };

  const setMapping = (aircraftType: string, category: MappingCategory | "") => {
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
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8 dark:bg-zinc-800 dark:border-zinc-400">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-400">
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

      {/* ═══ Glider / Lighter-than-Air Launch Totals ═══ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8 dark:bg-zinc-800 dark:border-zinc-400">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-400">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-white">
            Glider & Lighter-than-Air — Flight & Launch Totals
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-zinc-400">
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white">Category</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">PIC Flights</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">Dual Flights</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">Total Flights</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">Aero-Tows</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">Ground Launches</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">Powered Launches</th>
              </tr>
            </thead>
            <tbody>
              {launchRows.map((r) => {
                const isGlider = r.label === "Glider";
                return (
                  <tr key={r.label} className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-400 dark:hover:bg-zinc-700 transition-colors">
                    <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-700 dark:text-white font-medium">{r.label}</td>
                    {isGlider ? (
                      <>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{r.picFlights}</td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{r.dualFlights}</td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-300 dark:text-gray-600 text-right tabular-nums">—</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-300 dark:text-gray-600 text-right tabular-nums">—</td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-300 dark:text-gray-600 text-right tabular-nums">—</td>
                        <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{r.totalFlights}</td>
                      </>
                    )}
                    <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{r.aeroTows}</td>
                    <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{r.groundLaunches}</td>
                    <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{r.poweredLaunches}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Class Totals ═══ */}
      {classTotals.map((group) => (
        <div key={group.groupLabel} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8 dark:bg-zinc-800 dark:border-zinc-400">
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-400">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-white">
              {group.groupLabel} — Class Totals (hrs)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-zinc-400">
                  <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white"></th>
                  {group.subLabels.map((sl) => (
                    <th key={sl} className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">{sl}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((subRow) => (
                  <tr key={subRow.label} className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-400 dark:hover:bg-zinc-700 transition-colors">
                    <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-700 dark:text-white">{subRow.label}</td>
                    {subRow.values.map((v, i) => (
                      <td key={i} className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{fmtHrs(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ═══ Simulated Flight Totals ═══ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-8 dark:bg-zinc-800 dark:border-zinc-400">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-400">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-white">
            Simulated Flight — Device Totals (hrs)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-zinc-400">
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white"></th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">SE</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">ME</th>
                <th className="px-4 sm:px-6 py-2 text-xs font-semibold text-gray-600 dark:text-white text-right">Helicopter</th>
              </tr>
            </thead>
            <tbody>
              {simFlightRows.map((row) => (
                <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50 dark:border-zinc-400 dark:hover:bg-zinc-700 transition-colors">
                  <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-700 dark:text-white font-medium">{row.label}</td>
                  <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{fmtHrs(row.se)}</td>
                  <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{fmtHrs(row.me)}</td>
                  <td className="px-4 sm:px-6 py-2.5 text-sm text-gray-900 dark:text-white text-right tabular-nums">{fmtHrs(row.helicopter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Aircraft Type Mappings ═══ */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden dark:bg-zinc-800 dark:border-zinc-400">
        <button
          onClick={() => setExpandedSection(expandedSection === "mappings" ? null : "mappings")}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
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
                      <tr className="border-b-2 border-gray-200 dark:border-zinc-400">
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
                              onChange={(e) => setMapping(t, (e.target.value || "") as MappingCategory | "")}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-400 dark:text-white"
                            >
                              <option value="">— Unmapped —</option>
                              {(Object.keys(MAPPING_LABELS) as MappingCategory[]).map((cat) => (
                                <option key={cat} value={cat}>{MAPPING_LABELS[cat]}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-end gap-3">
                  {saveStatus && (
                    <span className={`text-sm ${saveStatus.type === "success" ? "text-green-600" : "text-red-600"}`}>
                      {saveStatus.message}
                    </span>
                  )}
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
