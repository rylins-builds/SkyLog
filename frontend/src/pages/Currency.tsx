import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";

// ── Types ──

type CategoryId =
  | "dayTakeoffs"
  | "dayLandings"
  | "nightTakeoffs"
  | "nightLandings"
  | "ifrApproaches"
  | "holdingProcedures";

interface CurrencyThreshold {
  minCount: number;
  daysWindow: number;
}

type CurrencyStatus = "current" | "expiring" | "notCurrent";

// ── Defaults ──

const DEFAULT_THRESHOLDS: Record<CategoryId, CurrencyThreshold> = {
  dayTakeoffs: { minCount: 3, daysWindow: 90 },
  dayLandings: { minCount: 3, daysWindow: 90 },
  nightTakeoffs: { minCount: 3, daysWindow: 90 },
  nightLandings: { minCount: 3, daysWindow: 90 },
  ifrApproaches: { minCount: 6, daysWindow: 180 },
  holdingProcedures: { minCount: 1, daysWindow: 180 },
};

const ALL_CATEGORY_IDS: CategoryId[] = [
  "dayTakeoffs",
  "dayLandings",
  "nightTakeoffs",
  "nightLandings",
  "ifrApproaches",
  "holdingProcedures",
];

const CATEGORY_LABELS: Record<CategoryId, string> = {
  dayTakeoffs: "Day Takeoffs",
  dayLandings: "Day Landings",
  nightTakeoffs: "Night Takeoffs",
  nightLandings: "Night Landings",
  ifrApproaches: "IFR Approaches",
  holdingProcedures: "Holding Procedures",
};

const CATEGORY_ICONS: Record<CategoryId, string> = {
  dayTakeoffs: "🛫",
  dayLandings: "🛬",
  nightTakeoffs: "🌙",
  nightLandings: "🌃",
  ifrApproaches: "📡",
  holdingProcedures: "🔄",
};

// ── Helpers ──

function getStatus(
  count: number,
  minCount: number,
  daysWindow: number,
  today: Date,
  lastDate: Date | null
): CurrencyStatus {
  if (count >= minCount) {
    if (lastDate) {
      const elapsed =
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      if (elapsed > daysWindow * 0.75) return "expiring";
    }
    return "current";
  }
  return "notCurrent";
}

function statusBadgeClass(status: CurrencyStatus): string {
  switch (status) {
    case "current":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700";
    case "expiring":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 ring-1 ring-yellow-300 dark:ring-yellow-700";
    case "notCurrent":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-700";
  }
}

function statusLabel(status: CurrencyStatus): string {
  switch (status) {
    case "current":
      return "Current";
    case "expiring":
      return "Expiring Soon";
    case "notCurrent":
      return "Not Current";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Sub-components ──

function StatusBadge({ status }: { status: CurrencyStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(status)}`}
    >
      {status === "current" && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === "expiring" && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {status === "notCurrent" && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {statusLabel(status)}
    </span>
  );
}

function ProgressBar({
  count,
  min,
}: {
  count: number;
  min: number;
}) {
  const pct = min > 0 ? Math.min((count / min) * 100, 100) : 0;
  const isMet = count >= min;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-500 dark:text-gray-400 font-medium">
          {count} / {min}
        </span>
        <span className={`font-semibold ${isMet ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
          {isMet ? "Met" : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct >= 100
              ? "bg-green-500"
              : pct >= 75
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Merges API thresholds over defaults ──

function mergeThresholds(
  apiData: Record<string, { minCount: number; daysWindow: number } | undefined>
): Record<CategoryId, CurrencyThreshold> {
  const result = { ...DEFAULT_THRESHOLDS };
  for (const cat of ALL_CATEGORY_IDS) {
    const entry = apiData[cat];
    if (entry) {
      result[cat] = { minCount: entry.minCount, daysWindow: entry.daysWindow };
    }
  }
  return result;
}

// ── Main Component ──

export default function Currency() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [thresholds, setThresholds] = useState<
    Record<CategoryId, CurrencyThreshold>
  >(DEFAULT_THRESHOLDS);
  const [thresholdsLoaded, setThresholdsLoaded] = useState(false);
  const [editingThreshold, setEditingThreshold] =
    useState<CategoryId | null>(null);
  const [editMin, setEditMin] = useState<number>(0);
  const [editDays, setEditDays] = useState<number>(0);
  const [error, setError] = useState("");
  const [flightsLoaded, setFlightsLoaded] = useState(false);

  // Load flights
  useEffect(() => {
    api
      .listFlights()
      .then((data) => { setFlights(data); setFlightsLoaded(true); })
      .catch((e) => { setError(e.message); setFlightsLoaded(true); });
  }, []);

  // Load thresholds from API
  useEffect(() => {
    api
      .getCurrencyThresholds()
      .then((res) => {
        setThresholds(mergeThresholds(res.thresholds));
        setThresholdsLoaded(true);
      })
      .catch(() => {
        // Fall back to defaults if API unavailable
        setThresholds(DEFAULT_THRESHOLDS);
        setThresholdsLoaded(true);
      });
  }, []);

  // ── Compute counters per category ──
  const counters = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    function sumForCategory(
      threshold: CurrencyThreshold,
      flightPredicate: (f: Flight) => number
    ): { count: number; lastDate: Date | null } {
      const cutoff = new Date(
        today.getTime() - threshold.daysWindow * 24 * 60 * 60 * 1000
      );
      let count = 0;
      let lastDate: Date | null = null;
      for (const f of flights) {
        const fd = new Date(f.date + "T00:00:00");
        if (fd >= cutoff && fd <= today) {
          count += flightPredicate(f);
          if (!lastDate || fd > lastDate) lastDate = fd;
        }
      }
      return { count, lastDate };
    }

    const dayTakeoffs = sumForCategory(
      thresholds.dayTakeoffs,
      (f) => f.takeoffs_day
    );
    const dayLandings = sumForCategory(
      thresholds.dayLandings,
      (f) => f.landings_day
    );
    const nightTakeoffs = sumForCategory(
      thresholds.nightTakeoffs,
      (f) => f.takeoffs_night
    );
    const nightLandings = sumForCategory(
      thresholds.nightLandings,
      (f) => f.landings_night
    );

    // IFR approaches: sum precision_approaches + non_precision_approaches
    const ifrApproaches = sumForCategory(
      thresholds.ifrApproaches,
      (f) => (f.precision_approaches || 0) + (f.non_precision_approaches || 0)
    );

    // Holding procedures: sum holding_patterns
    const holdingProcedures = sumForCategory(
      thresholds.holdingProcedures,
      (f) => f.holding_patterns || 0
    );

    return {
      dayTakeoffs,
      dayLandings,
      nightTakeoffs,
      nightLandings,
      ifrApproaches,
      holdingProcedures,
    };
  }, [flights, thresholds]);

  // ── Status for each category ──
  const statuses = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const result = {} as Record<CategoryId, CurrencyStatus>;
    for (const cat of ALL_CATEGORY_IDS) {
      const c = counters[cat];
      const t = thresholds[cat];
      result[cat] = getStatus(c.count, t.minCount, t.daysWindow, today, c.lastDate);
    }
    return result;
  }, [counters, thresholds]);

  // IFR combined
  const ifrCombined = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const totalCount =
      counters.ifrApproaches.count + counters.holdingProcedures.count;
    const minCount =
      thresholds.ifrApproaches.minCount +
      thresholds.holdingProcedures.minCount;

    const lastDates = [
      counters.ifrApproaches.lastDate,
      counters.holdingProcedures.lastDate,
    ].filter(Boolean) as Date[];
    const lastDate =
      lastDates.length > 0
        ? new Date(Math.max(...lastDates.map((d) => d.getTime())))
        : null;

    const daysWindow = thresholds.ifrApproaches.daysWindow;
    const status = getStatus(totalCount, minCount, daysWindow, today, lastDate);

    const expiresDate = lastDate
      ? new Date(lastDate.getTime() + daysWindow * 24 * 60 * 60 * 1000)
      : null;

    return { totalCount, minCount, lastDate, expiresDate, status };
  }, [counters, thresholds]);

  // ── Threshold editing ──
  const openThresholdEdit = useCallback((cat: CategoryId) => {
    const t = thresholds[cat];
    setEditMin(t.minCount);
    setEditDays(t.daysWindow);
    setEditingThreshold(cat);
  }, [thresholds]);

  const saveThresholdEdit = useCallback(async () => {
    if (!editingThreshold) return;
    const next = {
      ...thresholds,
      [editingThreshold]: { minCount: editMin, daysWindow: editDays },
    };
    setThresholds(next);

    // Persist to backend (all categories)
    const payload = ALL_CATEGORY_IDS.map((cat) => ({
      category_id: cat,
      min_count: next[cat].minCount,
      days_window: next[cat].daysWindow,
    }));
    try {
      await api.saveCurrencyThresholds(payload);
    } catch {
      setError("Failed to save thresholds");
      setTimeout(() => setError(""), 3000);
    }
    setEditingThreshold(null);
  }, [editingThreshold, editMin, editDays, thresholds]);

  const cancelThresholdEdit = useCallback(() => {
    setEditingThreshold(null);
  }, []);

  // All entries merged for recent list
  const allEntries = useMemo(() => {
    const result: {
      date: string;
      category: CategoryId;
      description: string;
    }[] = [];

    for (const f of flights) {
      if (f.takeoffs_day > 0)
        result.push({
          date: f.date,
          category: "dayTakeoffs",
          description: `${f.takeoffs_day} day takeoff${f.takeoffs_day !== 1 ? "s" : ""} — ${f.aircraft_reg}`,
        });
      if (f.landings_day > 0)
        result.push({
          date: f.date,
          category: "dayLandings",
          description: `${f.landings_day} day landing${f.landings_day !== 1 ? "s" : ""} — ${f.aircraft_reg}`,
        });
      if (f.takeoffs_night > 0)
        result.push({
          date: f.date,
          category: "nightTakeoffs",
          description: `${f.takeoffs_night} night takeoff${f.takeoffs_night !== 1 ? "s" : ""} — ${f.aircraft_reg}`,
        });
      if (f.landings_night > 0)
        result.push({
          date: f.date,
          category: "nightLandings",
          description: `${f.landings_night} night landing${f.landings_night !== 1 ? "s" : ""} — ${f.aircraft_reg}`,
        });
      const totalApproaches =
        (f.precision_approaches || 0) + (f.non_precision_approaches || 0);
      if (totalApproaches > 0)
        result.push({
          date: f.date,
          category: "ifrApproaches",
          description: `${totalApproaches} approach${totalApproaches !== 1 ? "es" : ""} (${f.precision_approaches || 0} precision, ${f.non_precision_approaches || 0} non-precision) — ${f.aircraft_reg}`,
        });
      if ((f.holding_patterns || 0) > 0)
        result.push({
          date: f.date,
          category: "holdingProcedures",
          description: `${f.holding_patterns} holding pattern${f.holding_patterns !== 1 ? "s" : ""} — ${f.aircraft_reg}`,
        });
    }

    result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return result;
  }, [flights]);

  // ── Render helpers ──
  function renderCategoryCard(cat: CategoryId) {
    const c = counters[cat];
    const t = thresholds[cat];
    const st = statuses[cat];
    const isEditing = editingThreshold === cat;

    return (
      <div
        key={cat}
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-gray-100 dark:border-zinc-400 p-5 animate-slide-up relative"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {CATEGORY_LABELS[cat]}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={st} />
            <button
              onClick={() =>
                isEditing ? cancelThresholdEdit() : openThresholdEdit(cat)
              }
              className={`p-1 rounded-md transition-colors ${
                isEditing
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-zinc-800"
              }`}
              title={isEditing ? "Close settings" : "Threshold settings"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Last event info */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {c.lastDate
            ? `Last: ${c.lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : "No entries in range"}
        </div>

        {/* Progress bar */}
        <ProgressBar count={c.count} min={t.minCount} />

        {/* Inline edit panel */}
        {isEditing && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-400 animate-fade-in">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Min Count
                </label>
                <input
                  type="number"
                  min={1}
                  value={editMin}
                  onChange={(e) => setEditMin(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 dark:border-zinc-400 dark:bg-zinc-800 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Days Window
                </label>
                <input
                  type="number"
                  min={1}
                  value={editDays}
                  onChange={(e) => setEditDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-300 dark:border-zinc-400 dark:bg-zinc-800 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelThresholdEdit}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveThresholdEdit}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Loading state ──
  if (!thresholdsLoaded || !flightsLoaded) {
    return (
      <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in">
        {/* Title — always visible */}
        <div className="flex items-center justify-between mb-4 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Currency</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Track your flight currency requirements across all categories</p>
          </div>
        </div>
        {/* IFR card skeleton */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl shadow-md border border-blue-100 dark:border-blue-900/50 p-6 mb-8">
          <div className="skeleton h-6 w-40 rounded mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white/70 dark:bg-zinc-900/70 rounded-lg p-3">
                <div className="skeleton h-3 w-20 rounded mb-2" />
                <div className="skeleton h-6 w-12 rounded mb-2" />
                <div className="skeleton h-2 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
        {/* Category cards skeleton */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-gray-100 dark:border-zinc-400 p-5">
              <div className="skeleton h-5 w-32 rounded mb-3" />
              <div className="skeleton h-3 w-20 rounded mb-3" />
              <div className="skeleton h-2 w-full rounded mb-1" />
              <div className="skeleton h-2 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && flights.length === 0) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-4 py-3 rounded-lg">
          <svg
            className="w-5 h-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Failed to load flight data: {error}</span>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (flights.length === 0) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="max-w-md mx-auto py-16">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">
            No currency data yet
          </h2>
          <p className="text-gray-500 mb-6 dark:text-white">
            Start by logging flights to track your currency. Instrument approach
            and holding pattern data will be pulled from your logbook entries.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("navigate", { detail: "add" })
              )
            }
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Log Your First Flight
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between mb-4 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Currency
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track your flight currency requirements across all categories
          </p>
        </div>
      </div>

      {/* ═══ IFR Currency Tracker (combined) ═══ */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl shadow-md border border-blue-100 dark:border-blue-900/50 p-6 mb-8 animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📡</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                IFR Currency
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Combined instrument approach and holding procedure currency
            </p>
          </div>
          <StatusBadge status={ifrCombined.status} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/70 dark:bg-zinc-900/70 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              Approaches
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {counters.ifrApproaches.count}
            </p>
            <div className="mt-1">
              <ProgressBar
                count={counters.ifrApproaches.count}
                min={thresholds.ifrApproaches.minCount}
              />
            </div>
          </div>
          <div className="bg-white/70 dark:bg-zinc-900/70 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              Holds
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {counters.holdingProcedures.count}
            </p>
            <div className="mt-1">
              <ProgressBar
                count={counters.holdingProcedures.count}
                min={thresholds.holdingProcedures.minCount}
              />
            </div>
          </div>
          <div className="bg-white/70 dark:bg-zinc-900/70 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              Combined Total
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {ifrCombined.totalCount}
              <span className="text-base font-normal text-gray-400">
                {" "}
                / {ifrCombined.minCount}
              </span>
            </p>
          </div>
          <div className="bg-white/70 dark:bg-zinc-900/70 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              Expires
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {ifrCombined.expiresDate
                ? ifrCombined.expiresDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
            {ifrCombined.expiresDate && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {ifrCombined.expiresDate.toLocaleDateString("en-US", {
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* ═══ Currency Cards Grid ═══ */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        All Categories
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {ALL_CATEGORY_IDS.map(renderCategoryCard)}
      </div>

      {/* ═══ Recent Entries Timeline ═══ */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-md border border-gray-100 dark:border-zinc-400 overflow-hidden animate-slide-up">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-400 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Entries
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {allEntries.length} total
          </span>
        </div>

        {allEntries.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            No qualifying entries in any category
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
            {allEntries.slice(0, 50).map((entry, idx) => (
              <div
                key={`${entry.date}-${entry.category}-${idx}`}
                className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* Date */}
                <span className="text-sm text-gray-600 dark:text-gray-400 font-mono w-24 shrink-0">
                  {formatDate(entry.date)}
                </span>

                {/* Icon */}
                <span className="text-lg shrink-0">
                  {CATEGORY_ICONS[entry.category]}
                </span>

                {/* Category label */}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 shrink-0">
                  {CATEGORY_LABELS[entry.category]}
                </span>

                {/* Description */}
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">
                  {entry.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
