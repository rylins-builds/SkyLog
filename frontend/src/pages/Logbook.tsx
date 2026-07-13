/**
 * Logbook.tsx — Main logbook view for SkyLog.
 *
 * Displays a sortable, filterable, searchable, paginated table of flight records.
 * Column visibility is configurable via Settings (stored in localStorage and synced
 * to the backend API for persistence across sessions). Sort and filter dropdowns
 * respect hidden columns so users never sort/filter by a column they've chosen to hide.
 *
 * Key responsibilities:
 *  - Fetch all flights from the API on mount
 *  - Support text search across several fields (type, reg, airports, PIC, remarks)
 *  - Provide per-category quick filters (e.g. "show only Solo flights")
 *  - Sort by any flight field in ascending/descending order
 *  - Paginate results with configurable page size (persisted in settings)
 *  - Render delete buttons per-row with confirmation
 *  - Emit custom DOM events to allow parent layout components to respond
 *    (e.g. "edit-flight" opens the edit modal, "navigate" routes internally)
 */

import { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";
import { loadSettings, saveSettings, loadVisibilityFromApi, type ColumnVisibility } from "../api/settings";

// ── Domain-specific types ────────────────────────────────────────────────────

/** Which flight field to sort by. Each value matches a key on the Flight type. */
type SortField =
  | "date" | "total_time" | "aircraft_type" | "aircraft_reg"
  | "departure" | "arrival"
  | "sel_time" | "ses_time" | "mel_time" | "mes_time"
  | "helicopter_time" | "gyroplane_time" | "powered_lift_time" | "glider_time" | "balloon_time" | "airship_time"
  | "solo_time" | "pic_time" | "sic_time" | "dual_time" | "instructor_time"
  | "xcountry_time" | "night_time"
  | "takeoffs_day" | "takeoffs_night"
  | "landings_day" | "landings_night"
  | "precision_approaches" | "non_precision_approaches"
  | "holding_patterns";

/** Ascending or descending sort direction. */
type SortDir = "asc" | "desc";

/**
 * Which quick filter is active. The empty string means "no filter".
 * When a FilterKey is set (e.g. "solo_time"), only flights where that
 * numeric field is > 0 are shown.
 */
type FilterKey =
  | "sel_time" | "ses_time" | "mel_time" | "mes_time"
  | "helicopter_time" | "gyroplane_time" | "powered_lift_time" | "glider_time" | "balloon_time" | "airship_time"
  | "solo_time" | "pic_time" | "sic_time" | "dual_time" | "instructor_time"
  | "xcountry_time" | "night_time"
  | "takeoffs_day" | "takeoffs_night"
  | "landings_day" | "landings_night"
  | "precision_approaches" | "non_precision_approaches"
  | "holding_patterns"
  | "";

/** Describes a single table column: identity key, human-readable label, and rendering function. */
interface ColumnDef {
  key: string;
  label: string;
  /** Given a Flight object, return the React node to display in this column's cells. */
  render: (flight: Flight) => React.ReactNode;
  /** If true, the column is always rendered regardless of the user's visibility settings. */
  alwaysVisible?: boolean;
}

/** Available page-size options. 0 is a sentinel meaning "show all rows". */
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100, 0] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function Logbook() {
  // ── Data state ────────────────────────────────────────────────────────────

  /** The full list of flights fetched from the API. */
  const [flights, setFlights] = useState<Flight[]>([]);

  /** If set, the API call failed and this is the error message to display. */
  const [error, setError] = useState("");

  // ── Search & pagination ───────────────────────────────────────────────────

  /** Current free-text search string. Reset to "" to show all results. */
  const [search, setSearch] = useState("");

  /** Current page index (0-based). Reset to 0 whenever search/filter/sort changes. */
  const [page, setPage] = useState(0);

  // ── Sort state ────────────────────────────────────────────────────────────

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /** Whether the sort-column dropdown menu is open. */
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // ── Quick-filter state ────────────────────────────────────────────────────

  const [activeFilter, setActiveFilter] = useState<FilterKey>("");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Persisted settings ────────────────────────────────────────────────────

  /**
   * Page size (number of rows per page). Initialised from localStorage on mount
   * so the user's preference survives page reloads. 0 means "All".
   */
  const [pageSize, setPageSize] = useState<number>(() => loadSettings().pageSize);

  /** Persist a new page size to localStorage and reset to the first page. */
  const persistPageSize = (size: number) => {
    setPageSize(size);
    setPage(0);
    const s = loadSettings();
    s.pageSize = size;
    saveSettings(s);
  };

  /**
   * Which columns are visible. Loaded from localStorage on initial render.
   * A custom "settingsUpdated" event keeps this in sync when the user changes
   * visibility in the Settings page while the Logbook is already open.
   */
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(
    () => loadSettings().columnVisibility
  );

  // Listen for settings changes broadcast by the Settings page
  useEffect(() => {
    const handler = () => setColumnVisibility(loadSettings().columnVisibility);
    window.addEventListener("settingsUpdated", handler);
    return () => window.removeEventListener("settingsUpdated", handler);
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────

  /** Fetch all flights on mount. */
  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  /**
   * Fetch column visibility from the backend API on mount.
   * The API stores per-user preferences that survive localStorage clears.
   * Once fetched we merge them into localStorage so loadSettings() stays consistent.
   */
  useEffect(() => {
    loadVisibilityFromApi().then(({ columnVisibility: cv }) => {
      setColumnVisibility(cv);
      const s = loadSettings();
      s.columnVisibility = cv;
      saveSettings(s);
    });
  }, []);

  // ── Outside-click handling for dropdown menus ─────────────────────────────

  /** Close sort/filter menus when the user clicks anywhere outside them. */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Error state ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg">
          {/* Exclamation-triangle icon */}
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to load flights: {error}</span>
        </div>
      </div>
    );
  }

  // ── Filtering logic ───────────────────────────────────────────────────────

  /** Lowercased, trimmed search query for case-insensitive matching. */
  const q = search.toLowerCase().trim();

  // Step 1: apply the free-text search across several text fields
  let filtered = q
    ? flights.filter(
        (f) =>
          f.aircraft_type.toLowerCase().includes(q) ||
          f.aircraft_reg.toLowerCase().includes(q) ||
          f.departure.toLowerCase().includes(q) ||
          f.arrival.toLowerCase().includes(q) ||
          f.pilot_in_command.toLowerCase().includes(q) ||
          (f.remarks && f.remarks.toLowerCase().includes(q))
      )
    : [...flights];

  // Step 2: apply the optional quick filter (show only rows with a positive value)
  // Each branch checks a specific Flight field and keeps rows where it is > 0.
  if (activeFilter === "sel_time") filtered = filtered.filter((f) => f.sel_time > 0);
  if (activeFilter === "ses_time") filtered = filtered.filter((f) => f.ses_time > 0);
  if (activeFilter === "mel_time") filtered = filtered.filter((f) => f.mel_time > 0);
  if (activeFilter === "mes_time") filtered = filtered.filter((f) => f.mes_time > 0);
  if (activeFilter === "helicopter_time") filtered = filtered.filter((f) => f.helicopter_time > 0);
  if (activeFilter === "gyroplane_time") filtered = filtered.filter((f) => f.gyroplane_time > 0);
  if (activeFilter === "powered_lift_time") filtered = filtered.filter((f) => f.powered_lift_time > 0);
  if (activeFilter === "glider_time") filtered = filtered.filter((f) => f.glider_time > 0);
  if (activeFilter === "balloon_time") filtered = filtered.filter((f) => f.balloon_time > 0);
  if (activeFilter === "airship_time") filtered = filtered.filter((f) => f.airship_time > 0);
  if (activeFilter === "solo_time") filtered = filtered.filter((f) => f.solo_time > 0);
  if (activeFilter === "pic_time") filtered = filtered.filter((f) => f.pic_time > 0);
  if (activeFilter === "sic_time") filtered = filtered.filter((f) => f.sic_time > 0);
  if (activeFilter === "dual_time") filtered = filtered.filter((f) => f.dual_time > 0);
  if (activeFilter === "instructor_time") filtered = filtered.filter((f) => f.instructor_time > 0);
  if (activeFilter === "xcountry_time") filtered = filtered.filter((f) => f.xcountry_time > 0);
  if (activeFilter === "night_time") filtered = filtered.filter((f) => f.night_time > 0);
  if (activeFilter === "takeoffs_day") filtered = filtered.filter((f) => f.takeoffs_day > 0);
  if (activeFilter === "takeoffs_night") filtered = filtered.filter((f) => f.takeoffs_night > 0);
  if (activeFilter === "landings_day") filtered = filtered.filter((f) => f.landings_day > 0);
  if (activeFilter === "landings_night") filtered = filtered.filter((f) => f.landings_night > 0);
  if (activeFilter === "precision_approaches") filtered = filtered.filter((f) => f.precision_approaches > 0);
  if (activeFilter === "non_precision_approaches") filtered = filtered.filter((f) => f.non_precision_approaches > 0);
  if (activeFilter === "holding_patterns") filtered = filtered.filter((f) => f.holding_patterns > 0);

  // ── Sorting ───────────────────────────────────────────────────────────────

  /** Sort the filtered list in-place by the selected field and direction. */
  filtered.sort((a, b) => {
    // Use safe defaults (empty string or 0) for missing values
    let aVal: string | number = a[sortField] ?? "";
    let bVal: string | number = b[sortField] ?? "";
    // String comparisons are case-insensitive
    if (typeof aVal === "string" && typeof bVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  /** When pageSize === 0 we treat it as "show all rows" by setting the size to the full count. */
  const effectivePageSize = pageSize === 0 ? filtered.length : pageSize;
  /** Total number of pages. At minimum 1 (even when there are zero rows). */
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  /** Clamp the current page to a valid range in case the filter reduced results below the current page. */
  const safePage = Math.min(page, totalPages - 1);
  /** Slice of rows for the current page. */
  const paged = filtered.slice(safePage * effectivePageSize, (safePage + 1) * effectivePageSize);

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Delete a flight record after user confirmation.
   * On success the flight is removed from local state so the UI updates immediately
   * without a re-fetch.
   */
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this flight record?")) return;
    try {
      await api.deleteFlight(id);
      setFlights((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // ── Dropdown option definitions ───────────────────────────────────────────

  /** Every field the user can sort by, with a human-readable label and the matching Flight key. */
  const sortOptions: { label: string; field: SortField }[] = [
    { label: "Date", field: "date" },
    { label: "Total Time", field: "total_time" },
    { label: "Aircraft Type", field: "aircraft_type" },
    { label: "Aircraft Registration", field: "aircraft_reg" },
    { label: "From", field: "departure" },
    { label: "To", field: "arrival" },
    { label: "Single Engine Land", field: "sel_time" },
    { label: "Single Engine Sea", field: "ses_time" },
    { label: "Multi Engine Land", field: "mel_time" },
    { label: "Multi Engine Sea", field: "mes_time" },
    { label: "Helicopter", field: "helicopter_time" },
    { label: "Gyroplane", field: "gyroplane_time" },
    { label: "Powered Lift", field: "powered_lift_time" },
    { label: "Glider", field: "glider_time" },
    { label: "Balloon", field: "balloon_time" },
    { label: "Airship", field: "airship_time" },
    { label: "Solo", field: "solo_time" },
    { label: "PIC", field: "pic_time" },
    { label: "SIC", field: "sic_time" },
    { label: "Dual Received", field: "dual_time" },
    { label: "Instructor", field: "instructor_time" },
    { label: "Cross Country", field: "xcountry_time" },
    { label: "Night", field: "night_time" },
    { label: "Day Takeoffs", field: "takeoffs_day" },
    { label: "Night Takeoffs", field: "takeoffs_night" },
    { label: "Day Landings", field: "landings_day" },
    { label: "Night Landings", field: "landings_night" },
    { label: "Precision Approaches", field: "precision_approaches" },
    { label: "Non-Precision Approaches", field: "non_precision_approaches" },
    { label: "Holding Patterns", field: "holding_patterns" },
  ];

  /** Every quick-filter option. */
  const filterOptions: { label: string; key: FilterKey }[] = [
    { label: "Single Engine Land", key: "sel_time" },
    { label: "Single Engine Sea", key: "ses_time" },
    { label: "Multi Engine Land", key: "mel_time" },
    { label: "Multi Engine Sea", key: "mes_time" },
    { label: "Helicopter", key: "helicopter_time" },
    { label: "Gyroplane", key: "gyroplane_time" },
    { label: "Powered Lift", key: "powered_lift_time" },
    { label: "Glider", key: "glider_time" },
    { label: "Balloon", key: "balloon_time" },
    { label: "Airship", key: "airship_time" },
    { label: "Solo", key: "solo_time" },
    { label: "PIC", key: "pic_time" },
    { label: "SIC", key: "sic_time" },
    { label: "Dual Received", key: "dual_time" },
    { label: "Instructor", key: "instructor_time" },
    { label: "Cross Country", key: "xcountry_time" },
    { label: "Night", key: "night_time" },
    { label: "Day Takeoffs", key: "takeoffs_day" },
    { label: "Night Takeoffs", key: "takeoffs_night" },
    { label: "Day Landings", key: "landings_day" },
    { label: "Night Landings", key: "landings_night" },
    { label: "Precision Approaches", key: "precision_approaches" },
    { label: "Non-Precision Approaches", key: "non_precision_approaches" },
    { label: "Holding Patterns", key: "holding_patterns" },
  ];

  /**
   * Mapping from SortField / FilterKey strings to the ColumnVisibility keys used
   * in settings. This lets us hide sort/filter options when the corresponding column
   * is hidden — there's no point sorting by a column the user chose to hide.
   *
   * NOTE: includes some keys (departureTime, arrivalTime) not present in sortOptions
   * but needed for completeness; they simply won't match any sort option.
   */
  const sortToColumnKey: Record<string, keyof ColumnVisibility> = {
    date: "date",
    total_time: "totalTime",
    aircraft_type: "aircraftType",
    aircraft_reg: "aircraftReg",
    departure: "departure",
    arrival: "arrival",
    departure_time: "departureTime",
    arrival_time: "arrivalTime",
    sel_time: "selTime",
    ses_time: "sesTime",
    mel_time: "melTime",
    mes_time: "mesTime",
    helicopter_time: "helicopterTime",
    gyroplane_time: "gyroplaneTime",
    powered_lift_time: "poweredLiftTime",
    glider_time: "gliderTime",
    balloon_time: "balloonTime",
    airship_time: "airshipTime",
    solo_time: "soloTime",
    pic_time: "picTime",
    sic_time: "sicTime",
    dual_time: "dualTime",
    instructor_time: "instructorTime",
    xcountry_time: "xcountryTime",
    night_time: "nightTime",
    takeoffs_day: "takeoffsDay",
    takeoffs_night: "takeoffsNight",
    landings_day: "landingsDay",
    landings_night: "landingsNight",
    precision_approaches: "precisionApproaches",
    non_precision_approaches: "nonPrecisionApproaches",
    holding_patterns: "holdingPatterns",
  };

  /** Sort options filtered to only include columns the user hasn't hidden. */
  const availableSortOptions = sortOptions.filter(
    (opt) => columnVisibility[sortToColumnKey[opt.field]]
  );

  /** Filter options filtered the same way. */
  const availableFilterOptions = filterOptions.filter(
    (opt) => columnVisibility[sortToColumnKey[opt.key]]
  );

  const activeSortLabel = sortOptions.find((o) => o.field === sortField)?.label ?? "Date";
  const activeFilterLabel = filterOptions.find((o) => o.key === activeFilter)?.label;

  // ── Column definitions ────────────────────────────────────────────────────

  /**
   * All columns the table could display. Each entry specifies a unique key,
   * a header label, and a render function that extracts/transforms the Flight data.
   *
   * The "actions" column has alwaysVisible: true to ensure the edit/delete buttons
   * are never hidden by the column-visibility settings.
   */
  const allColumns: ColumnDef[] = [
    { key: "date", label: "Date", alwaysVisible: true, render: (f) => f.date },
    { key: "pilotInCommand", label: "Pilot in Command", render: (f) => f.pilot_in_command },
    { key: "aircraftType", label: "Aircraft Type", render: (f) => f.aircraft_type },
    { key: "aircraftReg", label: "Aircraft Registration", render: (f) => f.aircraft_reg },
    { key: "departure", label: "From", render: (f) => f.departure },
    { key: "arrival", label: "To", render: (f) => f.arrival },
    { key: "totalTime", label: "Total Time", render: (f) => f.total_time.toFixed(1) },
    { key: "selTime", label: "Single Engine Land", render: (f) => f.sel_time.toFixed(1) },
    { key: "sesTime", label: "Single Engine Sea", render: (f) => f.ses_time.toFixed(1) },
    { key: "melTime", label: "Multi Engine Land", render: (f) => f.mel_time.toFixed(1) },
    { key: "mesTime", label: "Multi Engine Sea", render: (f) => f.mes_time.toFixed(1) },
    { key: "helicopterTime", label: "Helicopter", render: (f) => f.helicopter_time.toFixed(1) },
    { key: "gyroplaneTime", label: "Gyroplane", render: (f) => f.gyroplane_time.toFixed(1) },
    { key: "poweredLiftTime", label: "Powered Lift", render: (f) => f.powered_lift_time.toFixed(1) },
    { key: "gliderTime", label: "Glider", render: (f) => f.glider_time.toFixed(1) },
    { key: "balloonTime", label: "Balloon", render: (f) => f.balloon_time.toFixed(1) },
    { key: "airshipTime", label: "Airship", render: (f) => f.airship_time.toFixed(1) },
    { key: "soloTime", label: "Solo", render: (f) => f.solo_time.toFixed(1) },
    { key: "picTime", label: "PIC", render: (f) => f.pic_time.toFixed(1) },
    { key: "sicTime", label: "SIC", render: (f) => f.sic_time.toFixed(1) },
    { key: "dualTime", label: "Dual Received", render: (f) => f.dual_time.toFixed(1) },
    { key: "instructorTime", label: "Instructor", render: (f) => f.instructor_time.toFixed(1) },
    { key: "xcountryTime", label: "Cross Country", render: (f) => f.xcountry_time.toFixed(1) },
    { key: "nightTime", label: "Night", render: (f) => f.night_time.toFixed(1) },
    { key: "actInstrumentTime", label: "Actual Instrument", render: (f) => f.act_instrument_time.toFixed(1) },
    { key: "simInstrumentTime", label: "Hooded Instrument", render: (f) => f.sim_instrument_time.toFixed(1) },
    { key: "fullFlightSimulatorTime", label: "Full Flight Simulator", render: (f) => f.full_flight_simulator_time.toFixed(1) },
    { key: "flightTrainingDeviceTime", label: "Flight Training Device", render: (f) => f.flight_training_device_time.toFixed(1) },
    { key: "aviationTrainingDeviceTime", label: "Aviation Training Device", render: (f) => f.aviation_training_device_time.toFixed(1) },
    { key: "takeoffsDay", label: "Day Takeoffs", render: (f) => f.takeoffs_day },
    { key: "takeoffsNight", label: "Night Takeoffs", render: (f) => f.takeoffs_night },
    { key: "landingsDay", label: "Day Landings", render: (f) => f.landings_day },
    { key: "landingsNight", label: "Night Landings", render: (f) => f.landings_night },
    { key: "precisionApproaches", label: "Precision Approaches", render: (f) => f.precision_approaches },
    { key: "nonPrecisionApproaches", label: "Non-Precision Approaches", render: (f) => f.non_precision_approaches },
    { key: "holdingPatterns", label: "Holding Patterns", render: (f) => f.holding_patterns },
    { key: "launchType", label: "Glider/Lighter-than-Air Launch Type", render: (f) => {
      const displayLabels: Record<string, string> = {
        "aero_tow": "Aero-Tow",
        "ground_launch": "Ground Launch",
        "powered_launch": "Powered Launch",
      };
      return f.launch_type ? displayLabels[f.launch_type] || f.launch_type : "";
    }},
    { key: "remarks", label: "Remarks", render: (f) => f.remarks },
    {
      key: "actions",
      label: "Actions",
      alwaysVisible: true,
      render: (f) => (
        <div className="flex items-center gap-1">
          {/* Emit a custom event that the parent layout can listen for to open the edit modal */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("edit-flight", { detail: f.id }))}
            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Edit flight"
          >
            {/* Pencil icon */}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {/* Trash icon — triggers handleDelete with confirmation */}
          <button
            onClick={() => handleDelete(f.id)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete flight"
          >
            {/* Trash icon */}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  /**
   * The subset of columns to actually render. The "actions" column is always
   * included regardless of the user's visibility preferences.
   */
  const visibleColumns = allColumns.filter(
    (col) => col.alwaysVisible || columnVisibility[col.key as keyof ColumnVisibility]
  );

  // ── Empty state (no flights at all) ───────────────────────────────────────

  if (flights.length === 0) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="max-w-md mx-auto py-16">
          <div className="text-6xl mb-4">📖</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">No flights logged yet</h2>
          <p className="text-gray-500 mb-6 dark:text-white">
            Ready for takeoff? Add your first flight to get started.
          </p>
          {/* Emit a custom event that the parent layout can listen for to navigate to the add-flight page */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "add" }))}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors btn-primary"
          >
            {/* Plus icon */}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Flight
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-[95%] mx-auto animate-fade-in">
      {/* ── Header bar: title + sort/filter/search controls ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Logbook</h1>
        <div className="flex items-center justify-end sm:justify-start gap-1 sm:gap-2 flex-wrap w-full sm:w-auto">
          {/* ── Sort dropdown ──────────────────────────────────────────────── */}
          <div className="relative flex-initial" ref={sortRef}>
            <button
              onClick={() => { setShowSortMenu((v) => !v); setShowFilterMenu(false); }}
              className={`inline-flex items-center gap-1.5 px-1.5 sm:px-3 py-2 rounded-lg border text-sm font-medium leading-tight transition-colors ${
                showSortMenu
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-zinc-900 dark:border-blue-700 dark:text-blue-300"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-800"
              }`}
            >
              {/* Sort icon */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17h6m-6-5h9m5-1v8m0 0l3-3m-3 3l-3-3M4 7h12" />
              </svg>
              <span className="hidden sm:inline">{activeSortLabel}</span>
              {/* Chevron */}
              <svg className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSortMenu && (
              <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 dark:bg-zinc-800 dark:border-zinc-600">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Sort by
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {availableSortOptions.map((opt) => (
                    <button
                      key={opt.field}
                      onClick={() => {
                        // Tapping the same field toggles direction; tapping a new field defaults to descending
                        if (sortField === opt.field) {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortField(opt.field);
                          setSortDir("desc");
                        }
                        setPage(0);
                        setShowSortMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                        sortField === opt.field
                          ? "text-blue-600 font-medium dark:hover:bg-zinc-700"
                          : "text-gray-700 dark:text-white dark:hover:bg-zinc-700"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {/* Show current direction indicator next to the active option */}
                      {sortField === opt.field && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {sortDir === "desc"
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17h6m-6-5h9m5-1v8m0 0l3-3m-3 3l-3-3M4 7h12" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17h12M4 12h9M4 7h6m8 6V5m0 0l3 3m-3-3l-3 3" />
                          }
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                {/* Inline direction toggle inside the dropdown */}
                <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Direction</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setSortDir("asc"); setPage(0); setShowSortMenu(false); }}
                      className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${
                        sortDir === "asc"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:text-white dark:bg-zinc-700 dark:hover:bg-zinc-600"
                      }`}
                    >↑ Asc</button>
                    <button
                      onClick={() => { setSortDir("desc"); setPage(0); setShowSortMenu(false); }}
                      className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${
                        sortDir === "desc"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:text-white dark:bg-zinc-700 dark:hover:bg-zinc-600"
                      }`}
                    >↓ Desc</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Filter dropdown ────────────────────────────────────────────── */}
          <div className="relative flex-initial" ref={filterRef}>
            <button
              onClick={() => { setShowFilterMenu((v) => !v); setShowSortMenu(false); }}
              className={`inline-flex items-center gap-1.5 px-1.5 sm:px-3 py-2 rounded-lg border text-sm font-medium leading-tight transition-colors ${
                activeFilter
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : showFilterMenu
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-zinc-900 dark:text-blue-300 dark:border-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:text-white dark:bg-zinc-900 dark:border-zinc-600 dark:hover:bg-zinc-800"
              }`}
            >
              {/* Funnel icon */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 3H2l8 10v4l4 4v-8z" />
              </svg>
              <span className="hidden sm:inline">{activeFilterLabel ?? "Filter"}</span>
              {/* When a filter is active show a dismiss "×" chip */}
              {activeFilter && (
                <span
                  onClick={(e) => { e.stopPropagation(); setActiveFilter(""); setPage(0); }}
                  className="ml-0.5 w-4 h-4 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 flex items-center justify-center text-xs leading-none cursor-pointer"
                >×</span>
              )}
              {!activeFilter && (
                <svg className={`w-3.5 h-3.5 transition-transform ${showFilterMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 dark:bg-zinc-800 dark:border-zinc-600">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Filter by</div>
                <div className="max-h-64 overflow-y-auto">
                  {availableFilterOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        // Tapping the same filter again clears it
                        setActiveFilter(activeFilter === opt.key ? "" : opt.key);
                        setPage(0);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors dark:hover:bg-zinc-600 text-left ${
                        activeFilter === opt.key ? "text-amber-700 font-medium " : "text-gray-700 dark:text-white"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {activeFilter === opt.key && (
                        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                {activeFilter && (
                  <>
                    <div className="border-t border-gray-100 mt-1" />
                    <button
                      onClick={() => { setActiveFilter(""); setPage(0); setShowFilterMenu(false); }}
                      className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      Clear filter
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Search input ───────────────────────────────────────────────── */}
          <div className="relative">
            {/* Magnifying glass icon */}
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search flights..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm leading-tight placeholder:text-xs sm:placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden dark:bg-zinc-800 dark:border-zinc-600">
        {filtered.length === 0 ? (
          /* Empty result state: search/filter narrowed results to zero */
          <div className="text-center py-12 text-gray-500 dark:text-white">
            <p className="text-lg">No flights match your search{activeFilter ? " or filter" : ""}.</p>
            <button
              onClick={() => { setSearch(""); setActiveFilter(""); setPage(0); }}
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 underline"
            >
              Clear search{activeFilter ? " and filter" : ""}
            </button>
          </div>
        ) : (
          <>
            {/* Scrollable table wrapper — max-height prevents the table from pushing the page footer off-screen */}
            <div className="overflow-x-auto max-h-[calc(100vh-16rem)]">
              <table className="w-full text-center">
                <thead>
                  {/* Sticky header so column labels stay visible while scrolling vertically */}
                  <tr className="border-b-2 border-gray-200 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-600 sticky top-0 z-10">
                    {visibleColumns.map((col) => (
                      <th key={col.key} className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((flight, idx) => (
                    <tr
                      key={flight.id}
                      className="border-b border-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-700 logbook-row"
                      /* Staggered animation delay for a subtle cascade effect on page load */
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 whitespace-nowrap dark:text-white ${
                            col.key === "actions" ? "row-actions" : ""
                          }`}
                        >
                          {col.render(flight)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination bar ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border-t border-gray-200 text-xs sm:text-sm text-gray-600 dark:bg-zinc-900 dark:border-zinc-600 dark:text-gray-300">
              {/* Page-size selector */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-gray-500 dark:text-gray-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => persistPageSize(Number(e.target.value))}
                  className="px-1.5 sm:px-2 py-1 rounded border border-gray-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "All" : n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pagination controls — only render when there is more than one page */}
              {totalPages > 1 && (
                <>
                  <span className="hidden sm:inline">
                    Showing {safePage * effectivePageSize + 1}–
                    {Math.min((safePage + 1) * effectivePageSize, filtered.length)} of{" "}
                    {filtered.length} flights
                  </span>
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    {/* Previous page */}
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:hover:bg-zinc-700"
                    >
                      ‹ Prev
                    </button>
                    {/* Page-number buttons — show at most 5, centred around the current page */}
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                      const pg = start + i;
                      return (
                        <button
                          key={pg}
                          onClick={() => setPage(pg)}
                          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition-colors ${
                            pg === safePage
                              ? "bg-blue-600 text-white"
                              : "hover:bg-gray-200 text-gray-700 dark:text-gray-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {pg + 1}
                        </button>
                      );
                    })}
                    {/* Next page */}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors dark:hover:bg-zinc-700"
                    >
                      Next ›
                    </button>
                  </div>
                </>
              )}
              {/* Single-page summary when totalPages <= 1 */}
              {totalPages <= 1 && (
                <span className="text-gray-500 dark:text-gray-400">
                  {filtered.length} flight{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
