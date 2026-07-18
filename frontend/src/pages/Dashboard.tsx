/**
 * SkyLog Dashboard Page
 *
 * Fully customizable dashboard where each user can show/hide and reorder
 * stat-card tiles via drag-and-drop directly on the page.
 * "Recent Flights" is always rendered as a static section below the
 * stat-card grid (not included in customization).
 *
 * Layout is persisted per-user via the backend API.
 *
 * @module pages/Dashboard
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api/client";
import type { DashboardStats, Flight } from "../api/types";
import type { DashboardTileConfig, TileType } from "../dashboard/types";
import { TILE_REGISTRY } from "../dashboard/tileRegistry";
import { StatTile } from "../dashboard/tiles/StatTile";
import { RecentFlightsTile } from "../dashboard/tiles/RecentFlightsTile";
import { DashboardCustomizer } from "../dashboard/DashboardCustomizer";
import { loadSettings } from "../api/settings";
import type { ColumnVisibility } from "../api/settings";

/**
 * Maps every ColumnVisibility key that has a corresponding dashboard
 * TileType. When a column is toggled off in Settings, the matching
 * tile is excluded from the "Add Tiles" section of the dashboard
 * customizer. If the tile is already present on the dashboard it is
 * replaced with the next available non-hidden tile.
 */
const COLUMN_TO_TILE: Record<string, TileType> = {
  nightTime: "night-hours",
  selTime: "sel-time",
  sesTime: "ses-time",
  melTime: "mel-time",
  mesTime: "mes-time",
  helicopterTime: "helicopter-time",
  gyroplaneTime: "gyroplane-time",
  poweredLiftTime: "powered-lift-time",
  gliderTime: "glider-time",
  balloonTime: "balloon-time",
  airshipTime: "airship-time",
  soloTime: "solo-time",
  picTime: "pic-time",
  sicTime: "sic-time",
  dualTime: "dual-time",
  instructorTime: "instructor-time",
  xcountryTime: "xcountry-time",
  actInstrumentTime: "act-instrument-time",
  simInstrumentTime: "sim-instrument-time",
  fullFlightSimulatorTime: "full-flight-simulator-time",
  flightTrainingDeviceTime: "flight-training-device-time",
  aviationTrainingDeviceTime: "aviation-training-device-time",
  takeoffsDay: "takeoffs-day",
  takeoffsNight: "takeoffs-night",
  landingsDay: "landings-day",
  landingsNight: "landings-night",
  precisionApproaches: "precision-approaches",
  nonPrecisionApproaches: "non-precision-approaches",
  holdingPatterns: "holding-patterns",
};

/** Build the set of hidden tile types from current column visibility settings. */
function getHiddenTileTypes(): Set<TileType> {
  const settings = loadSettings();
  const hidden = new Set<TileType>();
  for (const [columnKey, tileType] of Object.entries(COLUMN_TO_TILE)) {
    if (settings.columnVisibility[columnKey as keyof ColumnVisibility] === false) {
      hidden.add(tileType);
    }
  }
  return hidden;
}

/** Re-index tile orders to be sequential (0, 1, 2, ...). */
function reindex(tiles: DashboardTileConfig[]): DashboardTileConfig[] {
  return tiles.map((t, i) => ({ ...t, order: i }));
}

/**
 * Remove any tiles whose type is in `hiddenTiles` and replace each
 * removal with the next non-hidden tile from the registry's definition
 * order that is not already present in the layout.
 */
function syncLayoutWithHiddenTiles(
  layout: DashboardTileConfig[],
  hiddenTiles: Set<TileType>,
): DashboardTileConfig[] {
  const alreadyPresent = new Set(layout.map((t) => t.type));

  // Build the candidate list of replacements in registry definition order
  const candidates: TileType[] = [];
  for (const def of Object.values(TILE_REGISTRY)) {
    if (!hiddenTiles.has(def.type) && !alreadyPresent.has(def.type)) {
      candidates.push(def.type);
    }
  }

  let candidateIdx = 0;
  const result: DashboardTileConfig[] = [];

  for (const tile of layout) {
    if (hiddenTiles.has(tile.type)) {
      // Replace with next available candidate
      const replacementType = candidates[candidateIdx++];
      if (replacementType) {
        const def = TILE_REGISTRY[replacementType];
        result.push({ type: replacementType, width: def.defaultWidth, order: 0 });
      }
      // No replacement available → tile is simply removed
    } else {
      result.push({ ...tile });
    }
  }

  return reindex(result);
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFlights, setRecentFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<DashboardTileConfig[]>([]);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Ref to avoid re-entrant saves
  const isSyncingRef = useRef(false);

  // ── Load layout + data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [layoutRes, statsRes, flights] = await Promise.all([
          api.getDashboardLayout(),
          api.getDashboardStats(),
          api.listFlights(),
        ]);
        const rawLayout = layoutRes.layout as DashboardTileConfig[];

        // Apply hidden-tile sync on initial load
        const hiddenSet = getHiddenTileTypes();
        const synced = syncLayoutWithHiddenTiles(rawLayout, hiddenSet);

        // Persist the synced layout if it changed
        if (synced.length !== rawLayout.length || synced.some((t, i) => t.type !== rawLayout[i].type)) {
          try {
            await api.saveDashboardLayout(synced);
          } catch {
            // Non-critical – local state will display correctly
          }
        }

        setLayout(synced);
        setLayoutLoaded(true);
        setStats(statsRes);
        setRecentFlights(flights.slice(0, 5));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
  }, []);

  // ── Listen for settings changes and sync layout ──
  useEffect(() => {
    const handler = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      setLayout((prev) => {
        const hiddenSet = getHiddenTileTypes();
        const synced = syncLayoutWithHiddenTiles(prev, hiddenSet);

        // Persist if anything changed
        if (synced.length !== prev.length || synced.some((t, i) => t.type !== prev[i].type)) {
          api.saveDashboardLayout(synced).catch(() => {});
        }

        return synced;
      });

      isSyncingRef.current = false;
    };

    window.addEventListener("settingsUpdated", handler);
    return () => window.removeEventListener("settingsUpdated", handler);
  }, []);

  // ── Save layout to API ──
  const handleSaveLayout = useCallback(
    async (newLayout: DashboardTileConfig[]) => {
      try {
        // Strip any tiles that are now hidden before persisting
        const hiddenSet = getHiddenTileTypes();
        const synced = syncLayoutWithHiddenTiles(newLayout, hiddenSet);
        await api.saveDashboardLayout(synced);
        setLayout(synced);
        setShowCustomizer(false);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    },
    [],
  );

  // ── Toggle customize mode ──
  const toggleCustomize = () => {
    if (isCustomizing) {
      handleSaveLayout(layout);
    }
    setIsCustomizing(!isCustomizing);
  };

  // ── Drag-and-drop handlers ──

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;

    const newLayout = [...layout];
    [newLayout[dragIndex], newLayout[targetIndex]] = [newLayout[targetIndex], newLayout[dragIndex]];
    const reindexed = newLayout.map((t, i) => ({ ...t, order: i }));
    setLayout(reindexed);
    setDragIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    api.saveDashboardLayout(layout).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Unknown error");
    });
  };

  // ── Helper: resolve value for any tile type ──
  function statValue(tileType: TileType): number | string | undefined {
    if (!stats) return undefined;
    switch (tileType) {
      case "total-flights":                return stats.total_flights;
      case "total-hours":                  return `${stats.total_hours.toFixed(1)}`;
      case "night-hours":                  return `${stats.total_night_hours.toFixed(1)}`;
      case "hours-last-30-days":           return `${stats.hours_last_30_days.toFixed(1)}`;
      case "total-landings":               return stats.total_landings;
      case "unique-aircraft":              return stats.unique_aircraft;
      case "sel-time":                     return `${stats.sel_time.toFixed(1)}`;
      case "ses-time":                     return `${stats.ses_time.toFixed(1)}`;
      case "mel-time":                     return `${stats.mel_time.toFixed(1)}`;
      case "mes-time":                     return `${stats.mes_time.toFixed(1)}`;
      case "helicopter-time":              return `${stats.helicopter_time.toFixed(1)}`;
      case "gyroplane-time":               return `${stats.gyroplane_time.toFixed(1)}`;
      case "powered-lift-time":            return `${stats.powered_lift_time.toFixed(1)}`;
      case "glider-time":                  return `${stats.glider_time.toFixed(1)}`;
      case "balloon-time":                 return `${stats.balloon_time.toFixed(1)}`;
      case "airship-time":                 return `${stats.airship_time.toFixed(1)}`;
      case "solo-time":                    return `${stats.solo_time.toFixed(1)}`;
      case "pic-time":                     return `${stats.pic_time.toFixed(1)}`;
      case "sic-time":                     return `${stats.sic_time.toFixed(1)}`;
      case "dual-time":                    return `${stats.dual_time.toFixed(1)}`;
      case "instructor-time":              return `${stats.instructor_time.toFixed(1)}`;
      case "xcountry-time":                return `${stats.xcountry_time.toFixed(1)}`;
      case "act-instrument-time":          return `${stats.act_instrument_time.toFixed(1)}`;
      case "sim-instrument-time":          return `${stats.sim_instrument_time.toFixed(1)}`;
      case "full-flight-simulator-time":   return `${stats.full_flight_simulator_time.toFixed(1)}`;
      case "flight-training-device-time":  return `${stats.flight_training_device_time.toFixed(1)}`;
      case "aviation-training-device-time":return `${stats.aviation_training_device_time.toFixed(1)}`;
      case "takeoffs-day":                 return stats.takeoffs_day;
      case "takeoffs-night":               return stats.takeoffs_night;
      case "landings-day":                 return stats.landings_day;
      case "landings-night":               return stats.landings_night;
      case "precision-approaches":         return stats.precision_approaches;
      case "non-precision-approaches":     return stats.non_precision_approaches;
      case "holding-patterns":             return stats.holding_patterns;
      default:                             return undefined;
    }
  }

  // ── Compute tile types hidden because their column is toggled off ──
  const computedHiddenTileTypes: TileType[] = (() => {
    const hiddenSet = getHiddenTileTypes();
    return [...hiddenSet].sort();
  })();

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
  const sortedTiles = layout.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in dark:bg-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <div className="flex items-center gap-2">
          {/* Manage Tiles button — opens the slide-over panel */}
          <button
            onClick={() => setShowCustomizer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors dark:bg-zinc-900 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
            title="Show or hide tiles"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">Tiles</span>
          </button>
          {/* Edit / Done toggle — enables drag-and-drop mode */}
          <button
            onClick={toggleCustomize}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              isCustomizing
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:bg-zinc-900 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
            }`}
            title={isCustomizing ? "Done rearranging" : "Rearrange tiles"}
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
                Edit
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          Stat Card Tile Grid — reorderable via drag-and-drop
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 dark:text-white dark:bg-zinc-800 dark:border-zinc-300">
        {sortedTiles.map((tile, idx) => {
          const def = TILE_REGISTRY[tile.type];
          const spanClass = tile.width === 2 ? "col-span-2 sm:col-span-2 lg:col-span-2" : "";
          const value = statValue(tile.type);
          if (value === undefined) return null;

          return (
            <div
              key={tile.type}
              className={`${spanClass} ${
                isCustomizing
                  ? "relative cursor-grab active:cursor-grabbing"
                  : ""
              }`}
              draggable={isCustomizing}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              style={
                isCustomizing && dragIndex === idx
                  ? { opacity: 0.5, transform: "scale(0.97)" }
                  : {}
              }
            >
              {isCustomizing && (
                <div className="absolute -top-2 -left-2 z-10">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">
                    {idx + 1}
                  </div>
                </div>
              )}
              <StatTile
                label={def?.label ?? tile.type}
                value={value}
                icon={def?.icon}
              />
            </div>
          );
        })}
      </div>

      {/* Reorder hint — shown in customize mode */}
      {isCustomizing && (
        <div className="mb-6 text-center animate-fade-in">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Drag tiles to rearrange. Click <strong>Done</strong> when finished.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          Recent Flights — static, NOT customizable
          ═══════════════════════════════════════════ */}
      <RecentFlightsTile flights={recentFlights} />

      {/* Customize slide-over panel (show/hide tiles) */}
      {showCustomizer && (
        <DashboardCustomizer
          layout={layout}
          hiddenTileTypes={computedHiddenTileTypes}
          onSave={handleSaveLayout}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}
