import { useState } from "react";
import { api } from "../api/client";

export default function EntryForm() {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    aircraft_type: "",
    aircraft_reg: "",
    departure: "",
    arrival: "",
    departure_time: "",
    arrival_time: "",
    total_time: "",
    night_time: "0",
    pic_time: "",
    sic_time: "0",
    dual_received: "0",
    dual_given: "0",
    actual_instrument: "0",
    sim_instrument: "0",
    approaches: "0",
    pilot_in_command: "",
    remarks: "",
    landings_day: "0",
    landings_night: "0",
    cross_country: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await api.createFlight({
        date: form.date,
        aircraft_type: form.aircraft_type,
        aircraft_reg: form.aircraft_reg,
        departure: form.departure.toUpperCase(),
        arrival: form.arrival.toUpperCase(),
        departure_time: form.departure_time || null,
        arrival_time: form.arrival_time || null,
        total_time: parseFloat(form.total_time),
        night_time: parseFloat(form.night_time) || 0,
        pic_time: parseFloat(form.pic_time) || 0,
        sic_time: parseFloat(form.sic_time) || 0,
        dual_received: parseFloat(form.dual_received) || 0,
        dual_given: parseFloat(form.dual_given) || 0,
        actual_instrument: parseFloat(form.actual_instrument) || 0,
        sim_instrument: parseFloat(form.sim_instrument) || 0,
        approaches: parseInt(form.approaches) || 0,
        pilot_in_command: form.pilot_in_command,
        remarks: form.remarks || null,
        landings_day: parseInt(form.landings_day) || 0,
        landings_night: parseInt(form.landings_night) || 0,
        cross_country: form.cross_country,
      });

      setMessage("Flight logged successfully!");
      setForm({
        date: new Date().toISOString().split("T")[0],
        aircraft_type: "",
        aircraft_reg: "",
        departure: "",
        arrival: "",
        departure_time: "",
        arrival_time: "",
        total_time: "",
        night_time: "0",
        pic_time: "",
        sic_time: "0",
        dual_received: "0",
        dual_given: "0",
        actual_instrument: "0",
        sim_instrument: "0",
        approaches: "0",
        pilot_in_command: "",
        remarks: "",
        landings_day: "0",
        landings_night: "0",
        cross_country: false,
      });
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Log New Flight</h1>

      {message && (
        <div
          className={`p-3 rounded-lg mb-4 ${
            message.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section: Basic Info */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-gray-700 px-2">Flight Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <Field label="Date" name="date" type="date" value={form.date} onChange={handleChange} required />
            <Field label="Pilot in Command" name="pilot_in_command" value={form.pilot_in_command} onChange={handleChange} required />
            <Field label="Aircraft Type" name="aircraft_type" value={form.aircraft_type} onChange={handleChange} required />
            <Field label="Registration" name="aircraft_reg" value={form.aircraft_reg} onChange={handleChange} required />
            <Field label="Departure (ICAO)" name="departure" value={form.departure} onChange={handleChange} required />
            <Field label="Arrival (ICAO)" name="arrival" value={form.arrival} onChange={handleChange} required />
            <Field label="Departure Time" name="departure_time" type="time" value={form.departure_time} onChange={handleChange} />
            <Field label="Arrival Time" name="arrival_time" type="time" value={form.arrival_time} onChange={handleChange} />
          </div>
        </fieldset>

        {/* Section: Time Breakdown */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-gray-700 px-2">Time Breakdown (hours)</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            <Field label="Total Time *" name="total_time" type="number" step="0.1" value={form.total_time} onChange={handleChange} required />
            <Field label="PIC Time" name="pic_time" type="number" step="0.1" value={form.pic_time} onChange={handleChange} />
            <Field label="SIC Time" name="sic_time" type="number" step="0.1" value={form.sic_time} onChange={handleChange} />
            <Field label="Night Time" name="night_time" type="number" step="0.1" value={form.night_time} onChange={handleChange} />
            <Field label="Dual Received" name="dual_received" type="number" step="0.1" value={form.dual_received} onChange={handleChange} />
            <Field label="Dual Given" name="dual_given" type="number" step="0.1" value={form.dual_given} onChange={handleChange} />
            <Field label="Actual Instrument" name="actual_instrument" type="number" step="0.1" value={form.actual_instrument} onChange={handleChange} />
            <Field label="Sim Instrument" name="sim_instrument" type="number" step="0.1" value={form.sim_instrument} onChange={handleChange} />
          </div>
        </fieldset>

        {/* Section: Landings & Approaches */}
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-gray-700 px-2">Landings & Approaches</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            <Field label="Day Landings" name="landings_day" type="number" value={form.landings_day} onChange={handleChange} />
            <Field label="Night Landings" name="landings_night" type="number" value={form.landings_night} onChange={handleChange} />
            <Field label="Instrument Approaches" name="approaches" type="number" value={form.approaches} onChange={handleChange} />
          </div>
        </fieldset>

        {/* Checkbox & Remarks */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="cross_country"
            id="cross_country"
            checked={form.cross_country}
            onChange={handleChange}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="cross_country" className="text-sm text-gray-700">Cross Country</label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Log Flight"}
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
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}