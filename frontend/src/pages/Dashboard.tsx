/**
 * SkyLog Dashboard Page
 *
 * This is the landing page shown after the user authenticates. It displays:
 *   1. **Stat cards** — aggregated flight metrics (total flights, hours, etc.)
 *      computed server-side via ``GET /api/dashboard/stats``.
 *      Cards are reorderable via drag-and-drop with persistence to localStorage.
 *   2. **Recent flights** — the 5 most recent entries in a compact table.
 *      (Not included in the customization system in this version.)
 *
 * The page has three visual states managed by React:
 *   - **Loading** — skeleton placeholders while the API call is in flight.
 *   - **Empty** — a welcome message with a CTA to log the first flight.
 *   - **Data** — stat cards + recent flights table.
 *
 * @module pages/Dashboard
 */

import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DashboardStats, Flight } from "../api/types";

// ═════════════════════════════════════════════════════
// Stat Card Definitions
// ═════════════════════════════════════════════════════

interface StatCardDef {
  key: string;
  label: string;
  icon: string;
  getValue: (stats: DashboardStats) => string | number;
}

const ALL_STAT_CARDS: StatCardDef[] = [
  { key: "total_flights", label: "Total Flights", icon: "📊", getValue: (s) => s.total_flights },
  { key: "total_hours", label: "Total Hours", icon: "⏱️", getValue: (s) => `${s.total_hours.toFixed(1)}` },
  { key: "night_hours", label: "Night Hours", icon: "🌙", getValue: (s) => `${s.total_night_hours.toFixed(1)}` },
  { key: "hours_last_30", label: "Hours (Last 30 Days)", icon: "📅", getValue: (s) => `${s.hours_last_30_days.toFixed(1)}` },
  { key: "total_landings", label: "Total Landings", icon: "🛬", getValue: (s) => s.total_landings },
  { key: "unique_aircraft", label: "Unique Aircraft", icon: "🛩️", getValue: (s) => s.unique_aircraft },
];

const STORAGE_KEY = "skylog_dashboard_stat_order";

/** Load saved card order from localStorage, falling back to the default order. */
function loadCardOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore corrupt data
  }
  return ALL_STAT_CARDS.map((c) => c.key);
}

/** Persist the current card order to localStorage. */
function saveCardOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

/** Build the ordered StatCardDef list, appending any new definitions not yet in the saved order. */
function buildOrderedCards(cardOrder: string[]): StatCardDef[] {
  const ordered: StatCardDef[] = [];
  const used = new Set<string>();
  for (const key of cardOrder) {
    const def = ALL_STAT_CARDS.find((c) => c.key === key);
    if (def) {
      ordered.push(def);
      used.add(key);
    }
  }
  for (const def of ALL_STAT_CARDS) {
    if (!used.has(def.key)) {
      ordered.push(def);
    }
  }
  return ordered;
}

// ═════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFlights, setRecentFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [cardOrder, setCardOrder] = useState<string[]>(() => loadCardOrder());
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // On mount, fetch both the aggregated stats and the full flight list
  // in parallel, then take the 5 most recent for the "Recent Flights" table.
  useEffect(() => {
    Promise.all([
      api.getDashboardStats(),
      api.listFlights(),
    ])
      .then(([statsData, flightsData]) => {
        setStats(statsData);
        setRecentFlights(flightsData.slice(0, 5));
      })
      .catch((e) => setError(e.message));
  }, []);

  // ── Drag-and-drop handlers ──

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;
    // Swap the dragged card with the card at the target position
    const newOrder = [...cardOrder];
    [newOrder[dragIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[dragIndex]];
    setCardOrder(newOrder);
    setDragIndex(targetIndex);
  };

  const handleDrop = () => {
    setDragIndex(null);
    saveCardOrder(cardOrder);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  // ── Move via arrow buttons (for mobile / accessibility) ──

  const moveCard = (key: string, direction: "up" | "down") => {
    const idx = cardOrder.indexOf(key);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === cardOrder.length - 1) return;
    const newOrder = [...cardOrder];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setCardOrder(newOrder);
    saveCardOrder(newOrder);
  };

  // ── Toggle customize mode ──

  const toggleCustomize = () => {
    if (isCustomizing) {
      // Exiting — persist the final order
      saveCardOrder(cardOrder);
    }
    setIsCustomizing(!isCustomizing);
  };

  // ── Error state ──
  if (error) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:text-red-300">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to load dashboard: {error}</span>
        </div>
      </div>
    );
  }

  // ── Loading state (skeleton) ──
  if (!stats) {
    return (
      <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 dark:bg-zinc-900">
              <div className="skeleton h-4 w-24 mb-3" />
              <div className="skeleton h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state (no flights logged yet) ──
  if (stats.total_flights === 0) {
    return (
      <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in dark:bg-zinc-800">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 dark:text-white">Dashboard</h1>
        <div className="text-center py-16">
          <div className="text-6xl mb-4">✈️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">Welcome to SkyLog!</h2>
          <p className="text-gray-500 mb-6 dark:text-white">
            Your flight data will appear here once you start logging.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "add" }))}
            className="inline-flex items-center gap-2 bg-blue-600 dark:bg-blue-800 dark:text-white text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors btn-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Your First Flight
          </button>
        </div>
      </div>
    );
  }

  // ── Data state ──
  const orderedCards = buildOrderedCards(cardOrder);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in dark:bg-zinc-800">
      {/* Header — title + customize toggle (only visible in data state) */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <button
          onClick={toggleCustomize}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isCustomizing
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-zinc-700"
          }`}
          title={isCustomizing ? "Done customizing" : "Customize card layout"}
        >
          {isCustomizing ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Done
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Customize
            </>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════
          Stat Cards — reorderable when customizing
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {orderedCards.map((card, idx) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={card.getValue(stats)}
            icon={card.icon}
            isCustomizing={isCustomizing}
            isFirst={idx === 0}
            isLast={idx === orderedCards.length - 1}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onMoveUp={() => moveCard(card.key, "up")}
            onMoveDown={() => moveCard(card.key, "down")}
          />
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          Recent Flights Section — static, NOT customizable
          ═══════════════════════════════════════════ */}
      {recentFlights.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-slide-up dark:bg-zinc-900 dark:border-zinc-600">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Flights</h2>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "logbook" }))}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300"
            >
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800">
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Date</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Aircraft</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Reg.</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">From → To</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">Total</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">PIC</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white">SIC</th>
                </tr>
              </thead>
              <tbody>
                {recentFlights.map((flight, idx) => (
                  <tr
                    key={flight.id}
                    className="border-b border-gray-50 hover:bg-gray-50 logbook-row dark:border-zinc-600 dark:hover:bg-zinc-700"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.date}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.aircraft_type}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.aircraft_reg}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.departure}→{flight.arrival}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.total_time.toFixed(1)}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.pic_time.toFixed(1)}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 dark:text-white">{flight.sic_time.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════
// StatCard Sub-Component
// ═════════════════════════════════════════════════════

/**
 * A single stat card displaying a labelled metric with an emoji icon.
 * When `isCustomizing` is true, the card becomes draggable and shows
 * move up/down buttons for mobile/accessibility.
 */
function StatCard({
  label,
  value,
  icon,
  isCustomizing,
  isFirst,
  isLast,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  value: string | number;
  icon?: string;
  isCustomizing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      draggable={isCustomizing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl shadow-md p-4 sm:p-6 border stat-card animate-slide-up dark:bg-zinc-900 ${
        isCustomizing
          ? "border-blue-300 dark:border-blue-600 cursor-grab active:cursor-grabbing ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-gray-100 dark:border-zinc-600"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400 truncate">
          {label}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {isCustomizing && (
            <div className="flex flex-col gap-0.5 mr-1">
              <button
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                disabled={isFirst}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                title="Move up"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                disabled={isLast}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                title="Move down"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
          {icon && <span className="text-lg sm:text-xl">{icon}</span>}
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
