/**
 * Settings.tsx — Application settings page for SkyLog.
 *
 * Provides a central UI for users to configure:
 *  - Page visibility: toggle optional pages (Currency, FAA 8710) on/off
 *  - Column visibility: show/hide individual columns in the Logbook table
 *  - User settings: change username, change password
 *  - Multi-user mode: admin-only toggle to enable/disable the login page
 *  - CSV import/export: download all flights as CSV, or upload a CSV to bulk-import
 *
 * Settings are persisted to localStorage for fast loading and synced to the backend
 * API (via saveVisibilityToApi / loadVisibilityFromApi) so they survive cache clears
 * and carry across devices when the user is signed in.
 *
 * A custom DOM event ("settingsUpdated") is dispatched whenever settings are saved
 * so that other open tabs/components (e.g. Logbook) can react immediately.
 */

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";
import {
  type PageVisibility,
  type ColumnVisibility,
  saveVisibilityToApi,
  loadVisibilityFromApi,
} from "../api/settings";

// ── Types ────────────────────────────────────────────────────────────────────

/** The aggregate settings object held in local component state. */
interface SettingsState {
  pageVisibility: PageVisibility;
  columnVisibility: ColumnVisibility;
  username: string;
  showLoginPage: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Settings() {
  // ── Local state ──────────────────────────────────────────────────────────

  /** All mutable settings fields, initialised with sensible defaults. */
  const [settings, setSettings] = useState<SettingsState>({
    pageVisibility: {
      currency: true,
      FAA8710: true,
    },
    columnVisibility: {
      date: true,
      pilotInCommand: true,
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
      gyroplaneTime: true,
      poweredLiftTime: true,
      gliderTime: true,
      balloonTime: true,
      airshipTime: true,
      soloTime: true,
      picTime: true,
      sicTime: true,
      dualTime: true,
      instructorTime: true,
      xcountryTime: true,
      nightTime: true,
      actInstrumentTime: true,
      simInstrumentTime: true,
      fullFlightSimulatorTime: true,
      flightTrainingDeviceTime: true,
      aviationTrainingDeviceTime: true,
      remarks: true,
      takeoffsDay: true,
      takeoffsNight: true,
      landingsDay: true,
      landingsNight: true,
      precisionApproaches: true,
      nonPrecisionApproaches: true,
      holdingPatterns: true,
      launchType: true,
    },
    username: "",
    showLoginPage: false,
  });

  // ── Multi-user mode state ─────────────────────────────────────────────────

  /** Whether the backend is currently in multi-user mode (login page enabled). */
  const [multiUserMode, setMultiUserMode] = useState(false);

  /** Whether the admin password confirmation modal is visible. */
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  /** When true, the modal is being shown to *enable* multi-user; when false, to *disable* it. */
  const [pendingMultiUser, setPendingMultiUser] = useState(false);

  /** Password entered in the modal. */
  const [modalPassword, setModalPassword] = useState("");

  /** Confirmation password (only shown when enabling). */
  const [modalConfirmPassword, setModalConfirmPassword] = useState("");

  // ── Change-password form state ────────────────────────────────────────────

  /** New password value. */
  const [password, setPassword] = useState("");

  /** New password confirmation (must match `password`). */
  const [confirmPassword, setConfirmPassword] = useState("");

  /** The user's current password (required to authorise the change). */
  const [currentPassword, setCurrentPassword] = useState("");

  // ── Feedback / UI state ───────────────────────────────────────────────────

  /** Transient error message (auto-clears after 3 s). */
  const [error, setError] = useState("");

  /** Transient success message (auto-clears after 3 s). */
  const [success, setSuccess] = useState("");

  /** True while an API call is in-flight (disables buttons and shows spinner). */
  const [isLoading, setIsLoading] = useState(false);

  /** Per-row errors from the last CSV import attempt. */
  const [importErrors, setImportErrors] = useState<{ row: number; error: string }[]>([]);

  /** Whether the import-error detail panel is expanded. */
  const [showImportErrors, setShowImportErrors] = useState(false);

  /** Whether the current user has admin privileges. */
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Initialisation ────────────────────────────────────────────────────────

  useEffect(() => {
    loadSettings();
    api.isAdmin().then(({ isAdmin: admin }) => setIsAdmin(admin)).catch(() => {});
    api.getMultiUserMode().then(({ multiUserMode: mum }) => {
      setMultiUserMode(mum);
    }).catch(() => {});
  }, []);

  /**
   * Load visibility settings from the backend API first (per-user, survives
   * localStorage clears). Falls back to localStorage if the API is unreachable.
   * Also loads the current username from the API.
   */
  const loadSettings = async () => {
    try {
      const { pageVisibility, columnVisibility } = await loadVisibilityFromApi();
      setSettings(prev => ({
        ...prev,
        pageVisibility,
        columnVisibility,
      }));

      const user = await api.getCurrentUser();
      setSettings(prev => ({ ...prev, username: user.username }));
    } catch (e) {
      // Fallback: load from localStorage
      try {
        const savedSettings = localStorage.getItem("flightLogbookSettings");
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch {
        // Ignore corrupt localStorage data
      }
      console.error("Failed to load settings:", e);
    }
  };

  // ── Save settings ─────────────────────────────────────────────────────────

  /**
   * Persist the current settings to:
   *  1. localStorage (fast local cache)
   *  2. Backend API (per-user, survives cache clear)
   * Then emit a "settingsUpdated" custom event so other open components react.
   */
  const saveSettings = async () => {
    try {
      setIsLoading(true);
      localStorage.setItem("flightLogbookSettings", JSON.stringify(settings));

      await saveVisibilityToApi(settings.pageVisibility, settings.columnVisibility);

      window.dispatchEvent(new CustomEvent("settingsUpdated", {
        detail: settings,
      }));

      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Failed to save settings");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Password change ───────────────────────────────────────────────────────

  /**
   * Validate the new-password inputs and send the change request to the API.
   * Requires the current password for authorisation.
   */
  const handlePasswordChange = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setTimeout(() => setError(""), 3000);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setTimeout(() => setError(""), 3000);
      return;
    }

    try {
      setIsLoading(true);
      await api.changePassword(currentPassword, password);
      setSuccess("Password changed successfully!");
      setPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Failed to change password");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Username change ───────────────────────────────────────────────────────

  /** Send the updated username to the API. */
  const handleUsernameChange = async () => {
    try {
      setIsLoading(true);
      await api.updateUsername(settings.username);
      setSuccess("Username updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Failed to update username");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Multi-user mode toggle ────────────────────────────────────────────────

  /**
   * Open the password-confirmation modal before toggling multi-user mode.
   * Enabling requires setting an admin password; disabling requires
   * entering the current admin password.
   */
  const handleToggleMultiUser = async () => {
    const next = !multiUserMode;
    if (next) {
      setPendingMultiUser(true);
      setModalPassword("");
      setModalConfirmPassword("");
      setShowPasswordModal(true);
    } else {
      setPendingMultiUser(false);
      setModalPassword("");
      setModalConfirmPassword("");
      setShowPasswordModal(true);
    }
  };

  /**
   * Submit the password from the modal. If successful the multi-user mode
   * is toggled and the page reloads to apply the change (clearing the token
   * so the auto-login or login page takes over).
   */
  const confirmPasswordModal = async () => {
    if (!modalPassword) {
      setError("Password is required");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (pendingMultiUser && modalPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setShowPasswordModal(false);
    setIsLoading(true);
    try {
      const result = await api.setMultiUserMode(pendingMultiUser, modalPassword);
      setMultiUserMode(result.multiUserMode);

      if (!result.multiUserMode) {
        // Multi-user was turned off — redirect to auto-login
        window.dispatchEvent(new CustomEvent("multiUserModeChanged"));
        localStorage.removeItem("skylog_token");
        window.location.reload();
      } else {
        setSuccess("Multi-user mode enabled! Redirecting to login...");
        setTimeout(() => {
          localStorage.removeItem("skylog_token");
          window.dispatchEvent(new CustomEvent("multiUserModeChanged"));
          window.location.reload();
        }, 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update multi-user mode");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  /** Dismiss the password modal without taking action. */
  const cancelPasswordModal = () => {
    setShowPasswordModal(false);
    setModalPassword("");
    setModalConfirmPassword("");
  };

  // ── CSV export ────────────────────────────────────────────────────────────

  /**
   * Fetch all flights from the API and generate a CSV string in the SkyLog
   * column order. Triggers a browser download via a temporary anchor element.
   * Filename includes the current date.
   */
  const handleExportCSV = async () => {
    try {
      setIsLoading(true);
      const flights = await api.listFlights();

      const launchTypeLabels: Record<string, string> = {
        "aero_tow": "Aero-Tow",
        "ground_launch": "Ground Launch",
        "powered_launch": "Powered Launch",
      };

      const headers = [
        "Date", "Pilot in Command", "Aircraft Type", "Registration", "Departure", "Arrival",
        "Departure Time", "Arrival Time", "Total Time", "SEL", "SES", "MEL",
        "MES", "Helicopter", "Gyroplane", "Powered Lift", "Glider", "Balloon", "Airship",
        "Solo", "PIC", "SIC", "Dual Received",
        "Instructor", "Cross Country", "Night", "Actual Instrument",
        "Simulated Instrument", "Full Flight Simulator", "Flight Training Device",
        "Aviation Training Device",
        "Takeoffs Day", "Takeoffs Night", "Landings Day", "Landings Night",
        "Precision Approaches", "Non-Precision Approaches", "Holding Patterns",
        "Glider/Lighter-than-Air Launch Type", "Remarks",
      ];

      const rows = flights.map((flight: Flight) => [
        flight.date,
        flight.pilot_in_command,
        flight.aircraft_type,
        flight.aircraft_reg,
        flight.departure,
        flight.arrival,
        flight.departure_time || "",
        flight.arrival_time || "",
        flight.total_time.toFixed(1),
        flight.sel_time?.toFixed(1) || "0.0",
        flight.ses_time?.toFixed(1) || "0.0",
        flight.mel_time?.toFixed(1) || "0.0",
        flight.mes_time?.toFixed(1) || "0.0",
        flight.helicopter_time?.toFixed(1) || "0.0",
        flight.gyroplane_time?.toFixed(1) || "0.0",
        flight.powered_lift_time?.toFixed(1) || "0.0",
        flight.glider_time?.toFixed(1) || "0.0",
        flight.balloon_time?.toFixed(1) || "0.0",
        flight.airship_time?.toFixed(1) || "0.0",
        flight.solo_time?.toFixed(1) || "0.0",
        flight.pic_time.toFixed(1),
        flight.sic_time.toFixed(1),
        flight.dual_time?.toFixed(1) || "0.0",
        flight.instructor_time?.toFixed(1) || "0.0",
        flight.xcountry_time?.toFixed(1) || "0.0",
        flight.night_time?.toFixed(1) || "0.0",
        flight.act_instrument_time?.toFixed(1) || "0.0",
        flight.sim_instrument_time?.toFixed(1) || "0.0",
        flight.full_flight_simulator_time?.toFixed(1) || "0.0",
        flight.flight_training_device_time?.toFixed(1) || "0.0",
        flight.aviation_training_device_time?.toFixed(1) || "0.0",
        flight.takeoffs_day || 0,
        flight.takeoffs_night || 0,
        flight.landings_day || 0,
        flight.landings_night || 0,
        flight.precision_approaches || 0,
        flight.non_precision_approaches || 0,
        flight.holding_patterns || 0,
        flight.launch_type ? launchTypeLabels[flight.launch_type] || flight.launch_type : "",
        flight.remarks || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(",")),
      ].join("\n");

      // Trigger browser download
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flights_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`Exported ${flights.length} flights successfully!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("Failed to export flights");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ── CSV import (parser + upload) ──────────────────────────────────────────

  /**
   * Parse a single CSV line, respecting double-quote escaping.
   * Handles commas inside quoted fields.
   */
  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  };

  /**
   * Handle file-upload for CSV import. Parses each data row (skipping the header)
   * and calls api.createFlight for each. Collects per-row errors so the user can
   * review which rows failed and why.
   *
   * After import, dispatches a "flightsUpdated" event so other components refresh.
   */
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setImportErrors([]);
      setShowImportErrors(false);
      const text = await file.text();
      const lines = text.split("\n");

      // Skip header row (line 0), process data rows
      const rows = lines.slice(1).filter(line => line.trim());
      let imported = 0;
      let failed = 0;
      const errors: { row: number; error: string }[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const line = rows[idx];
        const csvLineNumber = idx + 2; // +2 because we skipped the header (1) and arrays are 0-based
        let values: string[] = [];
        try {
          values = parseCSVLine(line);
          const launchTypeReverseLabels: Record<string, string> = {
            "Aero-Tow": "aero_tow",
            "Ground Launch": "ground_launch",
            "Powered Launch": "powered_launch",
          };

          // Expect 40 columns based on the export format
          if (values.length < 40) {
            const dateHint = values[0] ? ` (date: ${values[0]})` : "";
            errors.push({
              row: csvLineNumber,
              error: `Too few columns (got ${values.length}, need 40).${dateHint}`,
            });
            failed++;
            continue;
          }

          // Parse launch type from human-readable back to snake_case
          const rawLaunchType = values[37].trim();
          const launchType = rawLaunchType ? launchTypeReverseLabels[rawLaunchType] || rawLaunchType : null;

          await api.createFlight({
            date: values[0],
            pilot_in_command: values[1],
            aircraft_type: values[2],
            aircraft_reg: values[3],
            departure: values[4],
            arrival: values[5],
            departure_time: values[6] || null,
            arrival_time: values[7] || null,
            total_time: parseFloat(values[8]) || 0,
            sel_time: parseFloat(values[9]) || 0,
            ses_time: parseFloat(values[10]) || 0,
            mel_time: parseFloat(values[11]) || 0,
            mes_time: parseFloat(values[12]) || 0,
            helicopter_time: parseFloat(values[13]) || 0,
            gyroplane_time: parseFloat(values[14]) || 0,
            powered_lift_time: parseFloat(values[15]) || 0,
            glider_time: parseFloat(values[16]) || 0,
            balloon_time: parseFloat(values[17]) || 0,
            airship_time: parseFloat(values[18]) || 0,
            solo_time: parseFloat(values[19]) || 0,
            pic_time: parseFloat(values[20]) || 0,
            sic_time: parseFloat(values[21]) || 0,
            dual_time: parseFloat(values[22]) || 0,
            instructor_time: parseFloat(values[23]) || 0,
            xcountry_time: parseFloat(values[24]) || 0,
            night_time: parseFloat(values[25]) || 0,
            act_instrument_time: parseFloat(values[26]) || 0,
            sim_instrument_time: parseFloat(values[27]) || 0,
            full_flight_simulator_time: parseFloat(values[28]) || 0,
            flight_training_device_time: parseFloat(values[29]) || 0,
            aviation_training_device_time: parseFloat(values[30]) || 0,
            takeoffs_day: parseInt(values[31]) || 0,
            takeoffs_night: parseInt(values[32]) || 0,
            landings_day: parseInt(values[33]) || 0,
            landings_night: parseInt(values[34]) || 0,
            precision_approaches: parseInt(values[35]) || 0,
            non_precision_approaches: parseInt(values[36]) || 0,
            holding_patterns: parseInt(values[37]) || 0,
            launch_type: launchType,
            remarks: values[38] || null,
          });
          imported++;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          const dateHint = values?.[0] ? ` (date: ${values[0]})` : "";
          errors.push({
            row: csvLineNumber,
            error: `${errMsg}${dateHint}`,
          });
          failed++;
        }
      }

      event.target.value = "";
      setImportErrors(errors);

      if (failed > 0) {
        setSuccess(`Imported ${imported} flights (${failed} skipped due to errors).`);
        setShowImportErrors(true);
      } else {
        setSuccess(`Successfully imported ${imported} flights!`);
      }
      setTimeout(() => setSuccess(""), 5000);

      // Tell other components (e.g. Logbook, Dashboard) to refresh their data
      const updatedFlights = await api.listFlights();
      window.dispatchEvent(new CustomEvent("flightsUpdated", {
        detail: updatedFlights,
      }));
    } catch (e) {
      setError("Failed to import flights. Please check the CSV format.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Toggle helpers ────────────────────────────────────────────────────────

  /** Toggle visibility for an optional page (e.g. Currency, FAA 8710). */
  const togglePageVisibility = (page: keyof PageVisibility) => {
    setSettings(prev => ({
      ...prev,
      pageVisibility: {
        ...prev.pageVisibility,
        [page]: !prev.pageVisibility[page],
      },
    }));
  };

  /** Toggle visibility for a single logbook column. */
  const toggleColumnVisibility = (column: keyof ColumnVisibility) => {
    setSettings(prev => ({
      ...prev,
      columnVisibility: {
        ...prev.columnVisibility,
        [column]: !prev.columnVisibility[column],
      },
    }));
  };

  // ── UI option definitions ─────────────────────────────────────────────────

  /** Column groupings for the visibility settings UI. */
  const columnGroups = [
    {
      title: "Basic Information",
      columns: [
        { key: "pilotInCommand", label: "Pilot in Command" },
        { key: "aircraftType", label: "Aircraft Type" },
        { key: "aircraftReg", label: "Registration" },
        { key: "departure", label: "Departure" },
        { key: "arrival", label: "Arrival" },
        { key: "departureTime", label: "Departure Time" },
        { key: "arrivalTime", label: "Arrival Time" },
      ],
    },
    {
      title: "Time Categories",
      columns: [
        { key: "totalTime", label: "Total Time" },
        { key: "selTime", label: "Single Engine Land" },
        { key: "sesTime", label: "Single Engine Sea" },
        { key: "melTime", label: "Multi Engine Land" },
        { key: "mesTime", label: "Multi Engine Sea" },
        { key: "helicopterTime", label: "Helicopter" },
        { key: "gyroplaneTime", label: "Gyroplane" },
        { key: "poweredLiftTime", label: "Powered Lift" },
        { key: "gliderTime", label: "Glider" },
        { key: "balloonTime", label: "Balloon" },
        { key: "airshipTime", label: "Airship" },
      ],
    },
    {
      title: "Pilot Time",
      columns: [
        { key: "soloTime", label: "Solo" },
        { key: "picTime", label: "PIC" },
        { key: "sicTime", label: "SIC" },
        { key: "dualTime", label: "Dual Received" },
        { key: "instructorTime", label: "Instructor" },
      ],
    },
    {
      title: "Special Categories",
      columns: [
        { key: "xcountryTime", label: "Cross Country Time" },
        { key: "nightTime", label: "Night" },
        { key: "actInstrumentTime", label: "Actual Instrument" },
        { key: "simInstrumentTime", label: "Simulated Instrument" },
        { key: "fullFlightSimulatorTime", label: "Full Flight Simulator" },
        { key: "flightTrainingDeviceTime", label: "Flight Training Device" },
        { key: "aviationTrainingDeviceTime", label: "Aviation Training Device" },
      ],
    },
    {
      title: "Takeoffs & Landings",
      columns: [
        { key: "takeoffsDay", label: "Day Takeoffs" },
        { key: "takeoffsNight", label: "Night Takeoffs" },
        { key: "landingsDay", label: "Day Landings" },
        { key: "landingsNight", label: "Night Landings" },
      ],
    },
    {
      title: "Instrument Procedures",
      columns: [
        { key: "precisionApproaches", label: "Precision Approaches" },
        { key: "nonPrecisionApproaches", label: "Non-Precision Approaches" },
        { key: "holdingPatterns", label: "Holding Patterns" },
      ],
    },
    {
      title: "Other",
      columns: [
        { key: "launchType", label: "Launch Type" },
        { key: "remarks", label: "Remarks" },
      ],
    },
  ];

  /** Core pages that are always visible and cannot be toggled off. */
  const corePages = [
    { key: "dashboard", label: "Dashboard" },
    { key: "logbook", label: "Logbook" },
    { key: "settings", label: "Settings" },
    { key: "newFlight", label: "New Flight" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in dark:bg-zinc-800">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      {/* ── Page Visibility ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 animate-slide-up">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Page Visibility</h2>

        {/* Core pages — always on, rendered as informational cards */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Core Pages (always visible)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {corePages.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
                  Always On
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Togglable optional pages */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Optional Pages (toggle visibility)
          </p>
          <div className="space-y-3">
            {Object.entries(settings.pageVisibility).map(([page, visible]) => (
              <div key={page} className="flex items-center justify-between">
                <label className="text-gray-700 dark:text-gray-300 capitalize">
                  {page === "FAA8710" ? "FAA 8710" : page.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                {/* Custom toggle switch */}
                <button
                  onClick={() => togglePageVisibility(page as keyof PageVisibility)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    visible ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      visible ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Column Visibility ───────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 animate-slide-up"
        style={{ animationDelay: "100ms" }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Column Visibility</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Hide columns in the Logbook and New Flight form
        </p>

        {columnGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6 last:mb-0">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 border-b border-gray-200 dark:border-zinc-700 pb-2">
              {group.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {group.columns.map(({ key, label }) => {
                const columnKey = key as keyof ColumnVisibility;
                return (
                  <div key={key} className="flex items-center space-x-2">
                    {/* Custom checkbox */}
                    <button
                      onClick={() => toggleColumnVisibility(columnKey)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        settings.columnVisibility[columnKey]
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-400 dark:border-gray-500"
                      }`}
                    >
                      {settings.columnVisibility[columnKey] && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <label className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bulk show/hide buttons */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700 flex flex-wrap gap-3">
          <button
            onClick={() => {
              const allVisible = Object.keys(settings.columnVisibility).reduce((acc, key) => {
                acc[key as keyof ColumnVisibility] = true;
                return acc;
              }, {} as ColumnVisibility);
              setSettings(prev => ({ ...prev, columnVisibility: allVisible }));
            }}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
          >
            Show All
          </button>
          <button
            onClick={() => {
              const allHidden = Object.keys(settings.columnVisibility).reduce((acc, key) => {
                acc[key as keyof ColumnVisibility] = false;
                return acc;
              }, {} as ColumnVisibility);
              setSettings(prev => ({ ...prev, columnVisibility: allHidden }));
            }}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
          >
            Hide All
          </button>
        </div>
      </div>

      {/* ── User Settings ───────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 animate-slide-up"
        style={{ animationDelay: "200ms" }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Settings</h2>

        {/* Username */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <input
              type="text"
              value={settings.username}
              onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
              className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            />
            <button
              onClick={handleUsernameChange}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Update
            </button>
          </div>
        </div>

        {/* Password change */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Change Password
          </label>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            />
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-600 dark:text-white"
            />
            <button
              onClick={handlePasswordChange}
              disabled={isLoading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Multi-user mode toggle — only visible to admins */}
        {isAdmin && (
          <div className="pt-4 border-t border-gray-200 dark:border-zinc-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Multi-User Mode
            </label>
            <div className="flex items-start sm:items-center justify-between gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {multiUserMode
                  ? "Login page is active. Users sign in to access SkyLog."
                  : "Login page is disabled. You are automatically signed in as admin."}
              </span>
              <button
                onClick={handleToggleMultiUser}
                className={`relative w-12 h-6 rounded-full shrink-0 transition-colors ${
                  multiUserMode ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    multiUserMode ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Password confirmation modal (multi-user toggle) ────────────────── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border-2 border-black p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {pendingMultiUser ? "Enable Multi-User Mode" : "Disable Multi-User Mode"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {pendingMultiUser
                ? "Set an admin password to secure the login page. Other users can create their own accounts."
                : "Enter your admin password to disable multi-user mode."}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-white dark:border-zinc-500"
                  autoFocus
                />
              </div>
              {pendingMultiUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={modalConfirmPassword}
                    onChange={(e) => setModalConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-2 border-2 border-black rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-white dark:border-zinc-500"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={cancelPasswordModal}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmPasswordModal}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Import / Export ──────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-100 dark:bg-zinc-900 dark:border-zinc-600 animate-slide-up"
        style={{ animationDelay: "300ms" }}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">CSV Management</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Export button */}
          <div className="flex-1">
            <button
              onClick={handleExportCSV}
              disabled={isLoading}
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-center gap-2">
                {/* Download icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Flights (CSV)
              </div>
            </button>
          </div>

          {/* Import button — uses a hidden <input type="file"> triggered by the visible label */}
          <div className="flex-1">
            <label className="block w-full">
              <div className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center cursor-pointer">
                <div className="flex items-center justify-center gap-2">
                  {/* Upload icon */}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Flights (CSV)
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
                disabled={isLoading}
              />
            </label>
          </div>
        </div>

        {/* CSV format hint */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg dark:bg-zinc-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>CSV Format:</strong> Date, Pilot in Command, Aircraft Type, Registration, Departure, Arrival,
            Departure Time, Arrival Time, Total Time, SEL, SES, MEL, MES, Helicopter, Gyroplane,
            Powered Lift, Glider, Balloon, Airship, Solo, PIC, SIC, Dual Received, Instructor,
            Cross Country, Night, Actual Instrument, Simulated Instrument, Full Flight Simulator,
            Flight Training Device, Aviation Training Device,
            Takeoffs Day, Takeoffs Night, Landings Day, Landings Night, Precision Approaches,
            Non-Precision Approaches, Holding Patterns,
            Launch Type, Remarks
          </p>
        </div>
      </div>

      {/* ── Import error details (expandable panel) ─────────────────────────── */}
      {showImportErrors && importErrors.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-md border border-red-200 dark:bg-zinc-900 dark:border-red-800 animate-slide-up">
          <button
            onClick={() => setShowImportErrors(!showImportErrors)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
              Import Errors ({importErrors.length})
            </h3>
            {/* Chevron that rotates when the panel is expanded */}
            <svg
              className={`w-5 h-5 text-red-500 transition-transform ${
                showImportErrors ? "rotate-180" : ""
              }`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="px-4 pb-4 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-100 dark:border-red-900">
                  <th className="text-left py-2 pr-4 text-red-600 dark:text-red-400 font-medium w-20">Row</th>
                  <th className="text-left py-2 text-red-600 dark:text-red-400 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {importErrors.map((err, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 font-mono">{err.row}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300 break-words">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Toast notifications ──────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg dark:bg-red-900 dark:text-red-300 animate-fade-in">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg dark:bg-green-900 dark:text-green-300 animate-fade-in">
          {success}
        </div>
      )}

      {/* ── Save All Settings button ─────────────────────────────────────────── */}
      <button
        onClick={saveSettings}
        disabled={isLoading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 animate-slide-up"
        style={{ animationDelay: "400ms" }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            {/* Spinning loader */}
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Saving...
          </span>
        ) : (
          "Save All Settings"
        )}
      </button>
    </div>
  );
}
