import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";
import { loadSettings, loadVisibilityFromApi, type ColumnVisibility } from "../api/settings";

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
  glider_time: string;
  solo_time: string;
  pic_time: string;
  sic_time: string;
  dual_time: string;
  instructor_time: string;
  xcountry_time: string;
  night_time: string;
  act_instrument_time: string;
  sim_instrument_time: string;
  sim_time: string;
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
  glider_time: "",
  solo_time: "",
  pic_time: "",
  sic_time: "",
  dual_time: "",
  instructor_time: "",
  xcountry_time: "",
  night_time: "",
  act_instrument_time: "",
  sim_instrument_time: "",
  sim_time: "",
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

/** Convert a Flight object from the API into form state. */
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
  glider_time: flight.glider_time.toString(),
  solo_time: flight.solo_time.toString(),
  pic_time: flight.pic_time.toString(),
  sic_time: flight.sic_time.toString(),
  dual_time: flight.dual_time.toString(),
  instructor_time: flight.instructor_time.toString(),
  xcountry_time: flight.xcountry_time.toString(),
  night_time: flight.night_time.toString(),
  act_instrument_time: flight.act_instrument_time.toString(),
  sim_instrument_time: flight.sim_instrument_time.toString(),
  sim_time: flight.sim_time.toString(),
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

export default function EntryForm({ editFlightId }: { editFlightId?: number | null }) {
  const isEditMode = editFlightId != null;

  const [form, setForm] = useState<FormState>(initialForm());
  const [saving, setSaving] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(isEditMode);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Column visibility from settings
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

  // On mount (or editFlightId change), fetch flight data if editing
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = "Date is required";
    if (!form.aircraft_type.trim()) errs.aircraft_type = "Required";
    if (!form.aircraft_reg.trim()) errs.aircraft_reg = "Required";
    if (!form.departure.trim()) errs.departure = "Required";
    if (!form.arrival.trim()) errs.arrival = "Required";
    if (!form.pilot_in_command.trim()) errs.pilot_in_command = "Required";
    if (!form.total_time || parseFloat(form.total_time) <= 0) errs.total_time = "Must be > 0";
    if (form.sel_time && parseFloat(form.sel_time) < 0) errs.sel_time = "Cannot be negative";
    if (form.ses_time && parseFloat(form.ses_time) < 0) errs.ses_time = "Cannot be negative";
    if (form.mel_time && parseFloat(form.mel_time) < 0) errs.mel_time = "Cannot be negative";
    if (form.mes_time && parseFloat(form.mes_time) < 0) errs.mes_time = "Cannot be negative";
    if (form.helicopter_time && parseFloat(form.helicopter_time) < 0) errs.helicopter_time = "Cannot be negative";
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
    if (form.sim_time && parseFloat(form.sim_time) < 0) errs.sim_time = "Cannot be negative";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setMessage(null);

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
      glider_time: parseFloat(form.glider_time) || 0,
      solo_time: parseFloat(form.solo_time) || 0,
      pic_time: parseFloat(form.pic_time) || 0,
      sic_time: parseFloat(form.sic_time) || 0,
      dual_time: parseFloat(form.dual_time) || 0,
      instructor_time: parseFloat(form.instructor_time) || 0,
      xcountry_time: parseFloat(form.xcountry_time) || 0,
      night_time: parseFloat(form.night_time) || 0,
      act_instrument_time: parseFloat(form.act_instrument_time) || 0,
      sim_instrument_time: parseFloat(form.sim_instrument_time) || 0,
      sim_time: parseFloat(form.sim_time) || 0,
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
        setForm(initialForm());
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

  // Helper to check if a ColumnVisibility key maps to a visible form field
  const isFieldVisible = (visKey: string): boolean => {
    return columnVisibility[visKey as keyof ColumnVisibility] ?? true;
  };

  // Loading state when fetching flight for edit
  if (loadingFlight) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-white">Edit Flight</h1>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Error loading flight for edit
  if (loadError) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{loadError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-white">
        {isEditMode ? "Edit Flight" : "Log a New Flight"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isFieldVisible("date") && (
            <Field
              label="Date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              required
              error={errors.date}
            />
          )}
          {isFieldVisible("pilotInCommand") && (
            <Field
              label="Pilot in Command"
              name="pilot_in_command"
              value={form.pilot_in_command}
              onChange={handleChange}
              required
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
              label="Departure Time (Zulu)"
              name="departure_time"
              type="time"
              value={form.departure_time}
              onChange={handleChange}
            />
          )}
          {isFieldVisible("arrivalTime") && (
            <Field
              label="Arrival Time (Zulu)"
              name="arrival_time"
              type="time"
              value={form.arrival_time}
              onChange={handleChange}
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
          {isFieldVisible("simTime") && (
            <Field
              label="Simulator Time (hours)"
              name="sim_time"
              type="number"
              step="0.1"
              min="0"
              value={form.sim_time}
              onChange={handleChange}
              placeholder="0"
              error={errors.sim_time}
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

        {/* Remarks */}
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

        {/* Alert */}
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

        {/* Submit Button */}
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
  error?: string;
}) {
  return (
    <div>
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
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors placeholder:text-gray-400 ${
          error
            ? "border-red-400 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
