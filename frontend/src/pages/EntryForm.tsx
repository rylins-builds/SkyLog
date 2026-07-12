/**
 * SkyLog Flight Entry Form (Create / Edit)
 *
 * This page provides a comprehensive form for logging a new flight or
 * editing an existing one. It supports:
 *
 *   1. **Create mode** — all fields start empty (date defaults to today).
 *   2. **Edit mode** — loads an existing flight by ID and pre-fills all fields.
 *
 * The form layout respects the user's **column visibility** settings: if a
 * column is hidden in the Logbook, its corresponding form field is also
 * hidden here. This lets pilots declutter the form to only show the
 * categories they care about.
 *
 * Validation is performed client-side before submission:
 *   - Required fields: date, aircraft_type, aircraft_reg, departure,
 *     arrival, pilot_in_command, total_time (> 0).
 *   - Numeric fields must not be negative.
 *   - night_time cannot exceed total_time.
 *
 * @module pages/EntryForm
 */

import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";
import { loadSettings, loadVisibilityFromApi, type ColumnVisibility } from "../api/settings";

/** All form field values are stored as strings (even numerics) to simplify
 *  two-way binding with <input> elements. They are parsed on submit. */
interface FormState {
  date: string;
  aircraft_type: string;
  aircraft_reg: string;
  departure: string;
  arrival: string;
  departure_time: string;
  arrival_time: string;
  total_time: string;
  sel_time: string;
  ses_time: string;
  mel_time: string;
  mes_time: string;
  helicopter_time: string;
  gyroplane_time: string;
  powered_lift_time: string;
  glider_time: string;
  balloon_time: string;
  airship_time: string;
  solo_time: string;
  pic_time: string;
  sic_time: string;
  dual_time: string;
  instructor_time: string;
  xcountry_time: string;
  night_time: string;
  act_instrument_time: string;
  sim_instrument_time: string;
  full_flight_simulator_time: string;
  flight_training_device_time: string;
  aviation_training_device_time: string;
  pilot_in_command: string;
  remarks: string;
  takeoffs_day: string;
  takeoffs_night: string;
  landings_day: string;
  landings_night: string;
  precision_approaches: string;
  non_precision_approaches: string;
  holding_patterns: string;
}

/** Build the initial (empty) form state with date defaulting to today. */
const initialForm = (): FormState => ({
  date: new Date().toISOString().split("T")[0],
  aircraft_type: "",
  aircraft_reg: "",
  departure: "",
  arrival: "",
  departure_time: "",
  arrival_time: "",
  total_time: "",
  sel_time: "",
  ses_time: "",
  mel_time: "",
  mes_time: "",
  helicopter_time: "",
  gyroplane_time: "",
  powered_lift_time: "",
  glider_time: "",
  balloon_time: "",
  airship_time: "",
  solo_time: "",
  pic_time: "",
  sic_time: "",
  dual_time: "",
  instructor_time: "",
  xcountry_time: "",
  night_time: "",
  act_instrument_time: "",
  sim_instrument_time: "",
  full_flight_simulator_time: "",
  flight_training_device_time: "",
  aviation_training_device_time: "",
  pilot_in_command: "",
  remarks: "",
  takeoffs_day: "0",
  takeoffs_night: "0",
  landings_day: "0",
  landings_night: "0",
  precision_approaches: "0",
  non_precision_approaches: "0",
  holding_patterns: "0",
});

/** Convert a ``Flight`` object (from the API) into form state strings. */
const flightToForm = (flight: Flight): FormState => ({
  date: flight.date,
  aircraft_type: flight.aircraft_type,
  aircraft_reg: flight.aircraft_reg,
  departure: flight.departure,
  arrival: flight.arrival,
  departure_time: flight.departure_time ?? "",
  arrival_time: flight.arrival_time ?? "",
  total_time: flight.total_time.toString(),
  sel_time: flight.sel_time.toString(),
  ses_time: flight.ses_time.toString(),
  mel_time: flight.mel_time.toString(),
  mes_time: flight.mes_time.toString(),
  helicopter_time: flight.helicopter_time.toString(),
  gyroplane_time: flight.gyroplane_time.toString(),
  powered_lift_time: flight.powered_lift_time.toString(),
  glider_time: flight.glider_time.toString(),
  balloon_time: flight.balloon_time.toString(),
  airship_time: flight.airship_time.toString(),
  solo_time: flight.solo_time.toString(),
  pic_time: flight.pic_time.toString(),
  sic_time: flight.sic_time.toString(),
  dual_time: flight.dual_time.toString(),
  instructor_time: flight.instructor_time.toString(),
  xcountry_time: flight.xcountry_time.toString(),
  night_time: flight.night_time.toString(),
  act_instrument_time: flight.act_instrument_time.toString(),
  sim_instrument_time: flight.sim_instrument_time.toString(),
  full_flight_simulator_time: flight.full_flight_simulator_time.toString(),
  flight_training_device_time: flight.flight_training_device_time.toString(),
  aviation_training_device_time: flight.aviation_training_device_time.toString(),
  pilot_in_command: flight.pilot_in_command,
  remarks: flight.remarks ?? "",
  takeoffs_day: flight.takeoffs_day.toString(),
  takeoffs_night: flight.takeoffs_night.toString(),
  landings_day: flight.landings_day.toString(),
  landings_night: flight.landings_night.toString(),
  precision_approaches: flight.precision_approaches.toString(),
  non_precision_approaches: flight.non_precision_approaches.toString(),
  holding_patterns: flight.holding_patterns.toString(),
});

interface EntryFormProps {
  /** If provided, the form loads this flight's data for editing.
   *  If null/undefined, the form starts empty for a new entry. */
  editFlightId?: number | null;
}

export default function EntryForm({ editFlightId }: EntryFormProps) {
  const isEditMode = editFlightId != null;

  const [form, setForm] = useState<FormState>(initialForm());
  const [saving, setSaving] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(isEditMode);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Tracks whether the user has manually typed into the total_time field.
  // When true, the auto-calc effect will skip updating total_time.
  const totalTimeManuallySet = useRef(false);

  // ═══ Column visibility from settings ═══
  // We read visibility from both localStorage (synchronous on mount)
  // and the backend API (async, per-user persistence).
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => loadSettings().columnVisibility);
  useEffect(() => {
    const handler = () => setColumnVisibility(loadSettings().columnVisibility);
    window.addEventListener("settingsUpdated", handler);
    return () => window.removeEventListener("settingsUpdated", handler);
  }, []);

  // Load visibility from backend API (per-user, survives cache clear)
  useEffect(() => {
    loadVisibilityFromApi().then(({ columnVisibility: cv }) => {
      setColumnVisibility(cv);
    });
  }, []);

  // ═══ Load existing flight data when editing ═══
  useEffect(() => {
    if (editFlightId == null) {
      setForm(initialForm());
      setLoadingFlight(false);
      return;
    }
    setLoadingFlight(true);
    setLoadError("");
    api
      .getFlight(editFlightId)
      .then((flight) => {
        setForm(flightToForm(flight));
        setLoadingFlight(false);
      })
      .catch((err) => {
        setLoadError(`Failed to load flight: ${err.message}`);
        setLoadingFlight(false);
      });
  }, [editFlightId]);

  // ═══ Auto-calculate total time from departure/arrival Zulu ═══
  // Parses fields in "HHMM" format (e.g. 1430, 1645) and computes
  // elapsed hours. Re-runs whenever departure or arrival changes.
  // Skips if the user has manually typed into total_time (tracked via
  // totalTimeManuallySet ref).
  useEffect(() => {
    // Don't auto-calc if the user has manually typed into total_time
    if (totalTimeManuallySet.current) return;

    const dep = form.departure_time.trim();
    const arr = form.arrival_time.trim();

    // Both must be non-empty to calculate
    if (!dep || !arr) return;

    // Require exactly 4 digits ("HHMM") — never match partial input
    const timeRegex = /^(\d{2})(\d{2})$/;
    const depMatch = dep.match(timeRegex);
    const arrMatch = arr.match(timeRegex);
    if (!depMatch || !arrMatch) return;

    const depHour = parseInt(depMatch[1], 10);
    const depMin = parseInt(depMatch[2], 10);
    const arrHour = parseInt(arrMatch[1], 10);
    const arrMin = parseInt(arrMatch[2], 10);

    if (depHour > 23 || depMin > 59 || arrHour > 23 || arrMin > 59) return;

    const depTotalMin = depHour * 60 + depMin;
    const arrTotalMin = arrHour * 60 + arrMin;

    // If arrival is at or before departure, assume overnight (next Zulu day)
    let diffMin = arrTotalMin - depTotalMin;
    if (diffMin <= 0) diffMin += 1440;

    const hours = diffMin / 60;
    setForm(prev => ({ ...prev, total_time: hours.toFixed(1) }));
  }, [form.departure_time, form.arrival_time]);

  // ═══ Generic change handler for all inputs ═══
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // If user modifies total_time directly, mark as manually set so auto-calc stops
    if (name === "total_time" && value.trim() !== "") {
      totalTimeManuallySet.current = true;
    }
    // If user clears dep/arr, reset manual flag so auto-calc can restart
    if (name === "departure_time" || name === "arrival_time") {
      if (!value.trim()) totalTimeManuallySet.current = false;
    }
    // Clear the error for this field when the user starts typing again
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // ═══ Client-side validation ═══
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = "Date is required";
    if (!form.aircraft_type.trim()) errs.aircraft_type = "Required";
    if (!form.aircraft_reg.trim()) errs.aircraft_reg = "Required";
    if (!form.departure.trim()) errs.departure = "Required";
    if (!form.arrival.trim()) errs.arrival = "Required";
    if (!form.total_time || parseFloat(form.total_time) <= 0) errs.total_time = "Must be > 0";
    // Validate all numeric time fields are non-negative
    if (form.sel_time && parseFloat(form.sel_time) < 0) errs.sel_time = "Cannot be negative";
    if (form.ses_time && parseFloat(form.ses_time) < 0) errs.ses_time = "Cannot be negative";
    if (form.mel_time && parseFloat(form.mel_time) < 0) errs.mel_time = "Cannot be negative";
    if (form.mes_time && parseFloat(form.mes_time) < 0) errs.mes_time = "Cannot be negative";
    if (form.helicopter_time && parseFloat(form.helicopter_time) < 0) errs.helicopter_time = "Cannot be negative";
    if (form.gyroplane_time && parseFloat(form.gyroplane_time) < 0) errs.gyroplane_time = "Cannot be negative";
    if (form.powered_lift_time && parseFloat(form.powered_lift_time) < 0) errs.powered_lift_time = "Cannot be negative";
    if (form.glider_time && parseFloat(form.glider_time) < 0) errs.glider_time = "Cannot be negative";
    if (form.solo_time && parseFloat(form.solo_time) < 0) errs.solo_time = "Cannot be negative";
    if (form.pic_time && parseFloat(form.pic_time) < 0) errs.pic_time = "Cannot be negative";
    if (form.sic_time && parseFloat(form.sic_time) < 0) errs.sic_time = "Cannot be negative";
    if (form.dual_time && parseFloat(form.dual_time) < 0) errs.dual_time = "Cannot be negative";
    if (form.instructor_time && parseFloat(form.instructor_time) < 0) errs.instructor_time = "Cannot be negative";
    if (form.xcountry_time && parseFloat(form.xcountry_time) < 0) errs.xcountry_time = "Cannot be negative";
    if (form.night_time && parseFloat(form.night_time) < 0) errs.night_time = "Cannot be negative";
    if (form.night_time && form.total_time && parseFloat(form.night_time) > parseFloat(form.total_time)) {
      errs.night_time = "Cannot exceed total time";
    }
    if (form.act_instrument_time && parseFloat(form.act_instrument_time) < 0) errs.act_instrument_time = "Cannot be negative";
    if (form.sim_instrument_time && parseFloat(form.sim_instrument_time) < 0) errs.sim_instrument_time = "Cannot be negative";
    if (form.full_flight_simulator_time && parseFloat(form.full_flight_simulator_time) < 0) errs.full_flight_simulator_time = "Cannot be negative";
    if (form.flight_training_device_time && parseFloat(form.flight_training_device_time) < 0) errs.flight_training_device_time = "Cannot be negative";
    if (form.aviation_training_device_time && parseFloat(form.aviation_training_device_time) < 0) errs.aviation_training_device_time = "Cannot be negative";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ═══ Form submission (create or update) ═══
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setMessage(null);

    // Build the payload with all fields parsed to their correct types
    const payload = {
      date: form.date,
      aircraft_type: form.aircraft_type.trim(),
      aircraft_reg: form.aircraft_reg.trim().toUpperCase(),
      departure: form.departure.trim().toUpperCase(),
      arrival: form.arrival.trim().toUpperCase(),
      departure_time: form.departure_time || null,
      arrival_time: form.arrival_time || null,
      total_time: parseFloat(form.total_time),
      sel_time: parseFloat(form.sel_time) || 0,
      ses_time: parseFloat(form.ses_time) || 0,
      mel_time: parseFloat(form.mel_time) || 0,
      mes_time: parseFloat(form.mes_time) || 0,
      helicopter_time: parseFloat(form.helicopter_time) || 0,
      gyroplane_time: parseFloat(form.gyroplane_time) || 0,
      powered_lift_time: parseFloat(form.powered_lift_time) || 0,
      glider_time: parseFloat(form.glider_time) || 0,
      balloon_time: parseFloat(form.balloon_time) || 0,
      airship_time: parseFloat(form.airship_time) || 0,
      solo_time: parseFloat(form.solo_time) || 0,
      pic_time: parseFloat(form.pic_time) || 0,
      sic_time: parseFloat(form.sic_time) || 0,
      dual_time: parseFloat(form.dual_time) || 0,
      instructor_time: parseFloat(form.instructor_time) || 0,
      xcountry_time: parseFloat(form.xcountry_time) || 0,
      night_time: parseFloat(form.night_time) || 0,
      act_instrument_time: parseFloat(form.act_instrument_time) || 0,
      sim_instrument_time: parseFloat(form.sim_instrument_time) || 0,
      full_flight_simulator_time: parseFloat(form.full_flight_simulator_time) || 0,
      flight_training_device_time: parseFloat(form.flight_training_device_time) || 0,
      aviation_training_device_time: parseFloat(form.aviation_training_device_time) || 0,
      pilot_in_command: form.pilot_in_command.trim(),
      remarks: form.remarks.trim() || null,
      takeoffs_day: parseInt(form.takeoffs_day) || 0,
      takeoffs_night: parseInt(form.takeoffs_night) || 0,
      landings_day: parseInt(form.landings_day) || 0,
      landings_night: parseInt(form.landings_night) || 0,
      precision_approaches: parseInt(form.precision_approaches) || 0,
      non_precision_approaches: parseInt(form.non_precision_approaches) || 0,
      holding_patterns: parseInt(form.holding_patterns) || 0,
    };

    try {
      if (isEditMode) {
        await api.updateFlight(editFlightId, payload);
        setMessage({ type: "success", text: "Flight updated successfully!" });
      } else {
        await api.createFlight(payload);
        setMessage({ type: "success", text: "Flight logged successfully!" });
        setForm(initialForm());  // Reset form for another entry
      }
      setErrors({});
    } catch (err) {
      setMessage({
        type: "error",
        text: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setSaving(false);
    }
  };

  /** Check whether a given ColumnVisibility key maps to a visible form field. */
  const isFieldVisible = (visKey: string): boolean => {
    return columnVisibility[visKey as keyof ColumnVisibility] ?? true;
  };

  // ═══ Loading state (fetching flight for edit) ═══
  if (loadingFlight) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 dark:text-white">Edit Flight</h1>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ═══ Error loading flight for edit ═══
  if (loadError) {
    return (
      <div className="p-4 sm:p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{loadError}</span>
        </div>
      </div>
    );
  }

  // ═══ Render the form ═══
  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 dark:text-white">
        {isEditMode ? "Edit Flight" : "Log a New Flight"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 2-column grid of fields — each field is conditionally rendered
            based on columnVisibility */}        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 max-w-full">
          {isFieldVisible("date") && (
            <Field
              label="Date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              placeholder="e.g. 2026-07-06"
              error={errors.date}
            />
          )}
          {isFieldVisible("pilotInCommand") && (
            <Field
              label="Pilot in Command"
              name="pilot_in_command"
              value={form.pilot_in_command}
              onChange={handleChange}
              placeholder="e.g. Mike Brogan"
              error={errors.pilot_in_command}
            />
          )}
          {isFieldVisible("aircraftType") && (
            <Field
              label="Aircraft Type"
              name="aircraft_type"
              value={form.aircraft_type}
              onChange={handleChange}
              required
              placeholder="e.g. Cessna 172"
              error={errors.aircraft_type}
            />
          )}
          {isFieldVisible("aircraftReg") && (
            <Field
              label="Aircraft Registration"
              name="aircraft_reg"
              value={form.aircraft_reg}
              onChange={handleChange}
              required
              placeholder="e.g. N2860Q"
              error={errors.aircraft_reg}
            />
          )}
          {isFieldVisible("departure") && (
            <Field
              label="Departure (ICAO)"
              name="departure"
              value={form.departure}
              onChange={handleChange}
              required
              placeholder="e.g. KLAW"
              error={errors.departure}
            />
          )}
          {isFieldVisible("arrival") && (
            <Field
              label="Arrival (ICAO)"
              name="arrival"
              value={form.arrival}
              onChange={handleChange}
              required
              placeholder="e.g. KMIB"
              error={errors.arrival}
            />
          )}
          {isFieldVisible("departureTime") && (
            <Field
              label="Departure (Zulu)"
              name="departure_time"
              value={form.departure_time}
              onChange={handleChange}
              placeholder="e.g. 1430"
            />
          )}
          {isFieldVisible("arrivalTime") && (
            <Field
              label="Arrival (Zulu)"
              name="arrival_time"
              value={form.arrival_time}
              onChange={handleChange}
              placeholder="e.g. 1645"
            />
          )}
          {isFieldVisible("totalTime") && (
            <Field
              label="Total Time (hours)"
              name="total_time"
              type="number"
              step="0.1"
              min="0"
              value={form.total_time}
              onChange={handleChange}
              required
              placeholder="e.g. 2.3"
              error={errors.total_time}
            />
          )}
          {isFieldVisible("selTime") && (
            <Field
              label="Single Engine Land Time (hours)"
              name="sel_time"
              type="number"
              step="0.1"
              min="0"
              value={form.sel_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.sel_time}
            />
          )}
          {isFieldVisible("sesTime") && (
            <Field
              label="Single Engine Sea Time (hours)"
              name="ses_time"
              type="number"
              step="0.1"
              min="0"
              value={form.ses_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.ses_time}
            />
          )}
          {isFieldVisible("melTime") && (
            <Field
              label="Multi Engine Land Time (hours)"
              name="mel_time"
              type="number"
              step="0.1"
              min="0"
              value={form.mel_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.mel_time}
            />
          )}
          {isFieldVisible("mesTime") && (
            <Field
              label="Multi Engine Sea Time (hours)"
              name="mes_time"
              type="number"
              step="0.1"
              min="0"
              value={form.mes_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.mes_time}
            />
          )}
          {isFieldVisible("helicopterTime") && (
            <Field
              label="Helicopter Time (hours)"
              name="helicopter_time"
              type="number"
              step="0.1"
              min="0"
              value={form.helicopter_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.helicopter_time}
            />
          )}
          {isFieldVisible("gyroplaneTime") && (
            <Field
              label="Gyroplane Time (hours)"
              name="gyroplane_time"
              type="number"
              step="0.1"
              min="0"
              value={form.gyroplane_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.gyroplane_time}
            />
          )}
          {isFieldVisible("poweredLiftTime") && (
            <Field
              label="Powered Lift Time (hours)"
              name="powered_lift_time"
              type="number"
              step="0.1"
              min="0"
              value={form.powered_lift_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.powered_lift_time}
            />
          )}
          {isFieldVisible("gliderTime") && (
            <Field
              label="Glider Time (hours)"
              name="glider_time"
              type="number"
              step="0.1"
              min="0"
              value={form.glider_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.glider_time}
            />
          )}
          {isFieldVisible("balloonTime") && (
            <Field
              label="Balloon Time (hours)"
              name="balloon_time"
              type="number"
              step="0.1"
              min="0"
              value={form.balloon_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.balloon_time}
            />
          )}
          {isFieldVisible("airshipTime") && (
            <Field
              label="Airship Time (hours)"
              name="airship_time"
              type="number"
              step="0.1"
              min="0"
              value={form.airship_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.airship_time}
            />
          )}
          {isFieldVisible("soloTime") && (
            <Field
              label="Solo Time (hours)"
              name="solo_time"
              type="number"
              step="0.1"
              min="0"
              value={form.solo_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.solo_time}
            />
          )}
          {isFieldVisible("picTime") && (
            <Field
              label="PIC Time (hours)"
              name="pic_time"
              type="number"
              step="0.1"
              min="0"
              value={form.pic_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.pic_time}
            />
          )}
          {isFieldVisible("sicTime") && (
            <Field
              label="SIC Time (hours)"
              name="sic_time"
              type="number"
              step="0.1"
              min="0"
              value={form.sic_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.sic_time}
            />
          )}
          {isFieldVisible("dualTime") && (
            <Field
              label="Dual Time (hours)"
              name="dual_time"
              type="number"
              step="0.1"
              min="0"
              value={form.dual_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.dual_time}
            />
          )}
          {isFieldVisible("instructorTime") && (
            <Field
              label="Instructor Time (hours)"
              name="instructor_time"
              type="number"
              step="0.1"
              min="0"
              value={form.instructor_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.instructor_time}
            />
          )}
          {isFieldVisible("xcountryTime") && (
            <Field
              label="Cross Country Time (hours)"
              name="xcountry_time"
              type="number"
              step="0.1"
              min="0"
              value={form.xcountry_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.xcountry_time}
            />
          )}
          {isFieldVisible("nightTime") && (
            <Field
              label="Night Time (hours)"
              name="night_time"
              type="number"
              step="0.1"
              min="0"
              value={form.night_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.night_time}
            />
          )}
          {isFieldVisible("actInstrumentTime") && (
            <Field
              label="Actual Instrument Time (hours)"
              name="act_instrument_time"
              type="number"
              step="0.1"
              min="0"
              value={form.act_instrument_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.act_instrument_time}
            />
          )}
          {isFieldVisible("simInstrumentTime") && (
            <Field
              label="Hooded Instrument Time (hours)"
              name="sim_instrument_time"
              type="number"
              step="0.1"
              min="0"
              value={form.sim_instrument_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.sim_instrument_time}
            />
          )}
          {isFieldVisible("fullFlightSimulatorTime") && (
            <Field
              label="Full Flight Simulator Time (hours)"
              name="full_flight_simulator_time"
              type="number"
              step="0.1"
              min="0"
              value={form.full_flight_simulator_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.full_flight_simulator_time}
            />
          )}
          {isFieldVisible("flightTrainingDeviceTime") && (
            <Field
              label="Flight Training Device Time (hours)"
              name="flight_training_device_time"
              type="number"
              step="0.1"
              min="0"
              value={form.flight_training_device_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.flight_training_device_time}
            />
          )}
          {isFieldVisible("aviationTrainingDeviceTime") && (
            <Field
              label="Aviation Training Device Time (hours)"
              name="aviation_training_device_time"
              type="number"
              step="0.1"
              min="0"
              value={form.aviation_training_device_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.aviation_training_device_time}
            />
          )}
          {isFieldVisible("takeoffsDay") && (
            <Field
              label="Day Takeoffs"
              name="takeoffs_day"
              type="number"
              min="0"
              value={form.takeoffs_day}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("takeoffsNight") && (
            <Field
              label="Night Takeoffs"
              name="takeoffs_night"
              type="number"
              min="0"
              value={form.takeoffs_night}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("landingsDay") && (
            <Field
              label="Day Landings"
              name="landings_day"
              type="number"
              min="0"
              value={form.landings_day}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("landingsNight") && (
            <Field
              label="Night Landings"
              name="landings_night"
              type="number"
              min="0"
              value={form.landings_night}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("precisionApproaches") && (
            <Field
              label="Precision Approaches"
              name="precision_approaches"
              type="number"
              min="0"
              value={form.precision_approaches}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("nonPrecisionApproaches") && (
            <Field
              label="Non-Precision Approaches"
              name="non_precision_approaches"
              type="number"
              min="0"
              value={form.non_precision_approaches}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("holdingPatterns") && (
            <Field
              label="Holding Patterns"
              name="holding_patterns"
              type="number"
              min="0"
              value={form.holding_patterns}
              onChange={handleChange}
            />
          )}
        </div>

        {/* Remarks (spans the full width, not in the grid) */}
        {isFieldVisible("remarks") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">Remarks</label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              rows={3}
              placeholder="VFR flight, smooth conditions, worst landing ever, etc."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 resize-none dark:text-white"
            />
          </div>
        )}

        {/* Success/Error message banner */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg animate-slide-up ${
              message.type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            {message.type === "success" ? (
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors btn-primary flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {isEditMode ? "Updating..." : "Saving..."}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isEditMode ? "Update Flight" : "Log Flight"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/**
 * A single labelled form field with optional validation error display.
 *
 * @param label - The human-readable label shown above the input.
 * @param name - The field name (maps to FormState keys and the backend schema).
 * @param type - Input type (text, number, date, time).
 * @param value - Current value from the form state.
 * @param onChange - Change handler from the parent form.
 * @param required - Whether the field is required (shows a red asterisk).
 * @param step - "step" attribute for number inputs (e.g. 0.1 for tenths).
 * @param min - "min" attribute for number inputs.
 * @param placeholder - Placeholder text inside the input.
 * @param error - Validation error message (shown below the input if set).
 */
function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required,
  step,
  min,
  placeholder,
  pattern,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  step?: string;
  min?: string;
  placeholder?: string;
  pattern?: string;
  error?: string;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        step={step}
        min={min}
        placeholder={placeholder}
        pattern={pattern}
        className={`w-full min-w-0 max-w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors placeholder:text-gray-400 ${
          error
            ? "border-red-400 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
