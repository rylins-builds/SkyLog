/** Shared settings types for SkyLog */

export interface PageVisibility {
  currency: boolean;
  FAA8710: boolean;
}

export interface ColumnVisibility {
  date: boolean;
  aircraftType: boolean;
  aircraftReg: boolean;
  departure: boolean;
  arrival: boolean;
  departureTime: boolean;
  arrivalTime: boolean;
  totalTime: boolean;
  selTime: boolean;
  sesTime: boolean;
  melTime: boolean;
  mesTime: boolean;
  helicopterTime: boolean;
  gliderTime: boolean;
  soloTime: boolean;
  picTime: boolean;
  sicTime: boolean;
  dualTime: boolean;
  instructorTime: boolean;
  xcountryTime: boolean;
  nightTime: boolean;
  actInstrumentTime: boolean;
  simInstrumentTime: boolean;
  simTime: boolean;
  pilotInCommand: boolean;
  remarks: boolean;
  takeoffsDay: boolean;
  takeoffsNight: boolean;
  landingsDay: boolean;
  landingsNight: boolean;
  precisionApproaches: boolean;
  nonPrecisionApproaches: boolean;
  holdingPatterns: boolean;
  crossCountry: boolean;
  actions: boolean;
}

export interface SettingsData {
  pageVisibility: PageVisibility;
  columnVisibility: ColumnVisibility;
  username: string;
  pageSize: number;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  date: true,
  aircraftType: true,
  aircraftReg: true,
  departure: true,
  arrival: true,
  departureTime: true,
  arrivalTime: true,
  totalTime: true,
  selTime: true,
  sesTime: true,
  melTime: true,
  mesTime: true,
  helicopterTime: true,
  gliderTime: true,
  soloTime: true,
  picTime: true,
  sicTime: true,
  dualTime: true,
  instructorTime: true,
  xcountryTime: true,
  nightTime: true,
  actInstrumentTime: true,
  simInstrumentTime: true,
  simTime: true,
  pilotInCommand: true,
  remarks: true,
  takeoffsDay: true,
  takeoffsNight: true,
  landingsDay: true,
  landingsNight: true,
  precisionApproaches: true,
  nonPrecisionApproaches: true,
  holdingPatterns: true,
  crossCountry: true,
  actions: true,
};

export const DEFAULT_PAGE_VISIBILITY: PageVisibility = {
  currency: true,
  FAA8710: true,
};

const DEFAULT_PAGE_SIZE = 15;

/** Load settings from localStorage */
export function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem("flightLogbookSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pageVisibility: { ...DEFAULT_PAGE_VISIBILITY, ...parsed.pageVisibility },
        columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY, ...parsed.columnVisibility },
        username: parsed.username ?? "",
        pageSize: parsed.pageSize ?? DEFAULT_PAGE_SIZE,
      };
    }
  } catch {
    // ignore
  }
  return {
    pageVisibility: { ...DEFAULT_PAGE_VISIBILITY },
    columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
    username: "",
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/** Save settings to localStorage and broadcast */
export function saveSettings(settings: SettingsData): void {
  localStorage.setItem("flightLogbookSettings", JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
}

/** Core pages that are always visible and cannot be hidden */
export const CORE_PAGES = ["dashboard", "logbook", "add", "settings"] as const;

/** Optional pages that can be toggled via settings */
export const OPTIONAL_PAGES = ["currency", "FAA 8710"] as const;

/* ── Column ↔ field name mapping ── */

/** Map ColumnVisibility key → EntryForm field name for hiding fields */
export const COLUMN_TO_FORM_FIELD: Record<string, string> = {
  date: "date",
  aircraftType: "aircraft_type",
  aircraftReg: "aircraft_reg",
  departure: "departure",
  arrival: "arrival",
  departureTime: "departure_time",
  arrivalTime: "arrival_time",
  totalTime: "total_time",
  selTime: "sel_time",
  sesTime: "ses_time",
  melTime: "mel_time",
  mesTime: "mes_time",
  helicopterTime: "helicopter_time",
  gliderTime: "glider_time",
  soloTime: "solo_time",
  picTime: "pic_time",
  sicTime: "sic_time",
  dualTime: "dual_time",
  instructorTime: "instructor_time",
  xcountryTime: "xcountry_time",
  nightTime: "night_time",
  actInstrumentTime: "act_instrument_time",
  simInstrumentTime: "sim_instrument_time",
  simTime: "sim_time",
  pilotInCommand: "pilot_in_command",
  remarks: "remarks",
  takeoffsDay: "takeoffs_day",
  takeoffsNight: "takeoffs_night",
  landingsDay: "landings_day",
  landingsNight: "landings_night",
  precisionApproaches: "precision_approaches",
  nonPrecisionApproaches: "non_precision_approaches",
  holdingPatterns: "holding_patterns",
  crossCountry: "cross_country",
};

/** ColumnVisibility keys whose corresponding form fields are in the 2-column grid section (not standalone) */
export const FORM_GRID_FIELDS = new Set([
  "date", "aircraftType", "aircraftReg", "departure", "arrival",
  "departureTime", "arrivalTime", "totalTime", "selTime", "sesTime",
  "melTime", "mesTime", "helicopterTime", "gliderTime", "soloTime",
  "picTime", "sicTime", "dualTime", "instructorTime", "xcountryTime",
  "nightTime", "actInstrumentTime", "simInstrumentTime", "simTime",
  "pilotInCommand", "takeoffsDay", "takeoffsNight", "landingsDay", "landingsNight",
  "precisionApproaches", "nonPrecisionApproaches", "holdingPatterns",
]);
