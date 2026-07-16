/**
 * SkyLog Dashboard Page
 *
 * Fully customizable dashboard where each user can show/hide and reorder
 * tiles. Layouts are persisted per-user via the backend API.
 *
 * State management:
 *   - layout: loaded from API on mount (fallback to default from tileRegistry)
 *   - stats: aggregated dashboard statistics
 *   - recentFlights: 5 most recent flights for the RecentFlights tile
 *   - showCustomizer: toggle the customization slide-over panel
 *
 * @module pages/Dashboard
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import type { DashboardStats, Flight } from "../api/types";
import type { DashboardTileConfig, TileType } from "../dashboard/types";
import { TILE_REGISTRY } from "../dashboard/tileRegistry";
import { StatTile } from "../dashboard/tiles/StatTile";
import { RecentFlightsTile } from "../dashboard/tiles/RecentFlightsTile";
import { DashboardCustomizer } from "../dashboard/DashboardCustomizer";

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
  const [layout, setLayout] = useState<DashboardTileConfig[]>([]);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // ── Load layout + data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [layoutRes, statsRes, flights] = await Promise.all([
          api.getDashboardLayout(),
          api.getDashboardStats(),
          api.listFlights(),
        ]);
        setLayout(layoutRes.layout as DashboardTileConfig[]);
        setLayoutLoaded(true);
        setStats(statsRes);
        setRecentFlights(flights.slice(0, 5));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  // ── Save layout to API ──
  const handleSaveLayout = useCallback(
    async (newLayout: DashboardTileConfig[]) => {
      try {
        await api.saveDashboardLayout(newLayout);
        setLayout(newLayout);
        setShowCustomizer(false);
      } catch (e: any) {
        setError(e.message);
      }
    },
    [],
  );

  // ── Toggle customizer ──
  const toggleCustomizer = () => setShowCustomizer((v) => !v);

  // ── Helper: get value for a stat tile from stats ──
  function statValue(tileType: TileType): number | string | undefined {
    if (!stats) return undefined;
    switch (tileType) {
      case "total-flights":
        return stats.total_flights;
      case "total-hours":
        return `${stats.total_hours.toFixed(1)}`;
      case "night-hours":
        return `${stats.total_night_hours.toFixed(1)}`;
      case "hours-last-30-days":
        return `${stats.hours_last_30_days.toFixed(1)}`;
      case "total-landings":
        return stats.total_landings;
      case "unique-aircraft":
        return stats.unique_aircraft;
      default:
        return undefined;
    }
  }

  // ── Helper: icon for a tile ──
  function tileIcon(tileType: TileType): string | undefined {
    return TILE_REGISTRY[tileType]?.icon;
  }

  // ══════════════════════════════════════════
  // Render states
  // ══════════════════════════════════════════

  // ── Error state ──
  if (error) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:text-red-300">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Failed to load dashboard: {error}</span>
        </div>
      </div>
    );
  }

  // ── Loading state (skeleton) ──
  if (!layoutLoaded || !stats) {
    return (
      <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 dark:bg-zinc-900"
            >
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 dark:text-white">
          Dashboard
        </h1>
        <div className="text-center py-16">
          <div className="text-6xl mb-4">✈️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-white">
            Welcome to SkyLog!
          </h2>
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

  // Sort enabled tiles by order
  const sortedTiles = layout.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in dark:bg-zinc-800">
      {/* Header with customize button */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <button
          onClick={toggleCustomizer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors dark:bg-zinc-900 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Customize</span>
        </button>
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 dark:text-white dark:bg-zinc-800 dark:border-zinc-300">
        {sortedTiles.map((tile) => {
          const def = TILE_REGISTRY[tile.type];
          const spanClass = tile.width === 2 ? "col-span-2 sm:col-span-2 lg:col-span-2" : "";

          // Stat card tiles
          if (tile.type !== "recent-flights") {
            const value = statValue(tile.type);
            if (value === undefined) return null;
            return (
              <div key={tile.type} className={spanClass}>
                <StatTile
                  label={def?.label ?? tile.type}
                  value={value}
                  icon={tileIcon(tile.type)}
                />
              </div>
            );
          }

          // Recent flights tile
          return (
            <div key={tile.type} className={spanClass}>
              <RecentFlightsTile flights={recentFlights} />
            </div>
          );
        })}
      </div>

      {/* Customize slide-over panel */}
      {showCustomizer && (
        <DashboardCustomizer
          layout={layout}
          onSave={handleSaveLayout}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}
