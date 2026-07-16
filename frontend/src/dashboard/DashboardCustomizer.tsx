/**
 * DashboardCustomizer — a slide-over panel that lets the user
 * toggle tiles on/off and reorder them.
 *
 * @module dashboard/DashboardCustomizer
 */

import { useState, useEffect } from "react";
import type { DashboardTileConfig, TileType } from "./types";
import { TILE_REGISTRY, type TileDefinition } from "./tileRegistry";

interface DashboardCustomizerProps {
  /** Current layout being customized. */
  layout: DashboardTileConfig[];
  /** Called when the user saves changes. */
  onSave: (layout: DashboardTileConfig[]) => void;
  /** Called to close without saving. */
  onClose: () => void;
}

export function DashboardCustomizer({ layout, onSave, onClose }: DashboardCustomizerProps) {
  const [workingLayout, setWorkingLayout] = useState<DashboardTileConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWorkingLayout(layout.map((t) => ({ ...t })));
  }, [layout]);

  /** All tile types not currently in the layout (available to add). */
  const availableTiles = Object.values(TILE_REGISTRY).filter(
    (tileDef) => !workingLayout.some((t) => t.type === tileDef.type),
  );

  const enabledTiles = workingLayout
    .slice()
    .sort((a, b) => a.order - b.order);

  function handleToggle(tileType: TileType) {
    setWorkingLayout((prev) => {
      const exists = prev.find((t) => t.type === tileType);
      if (exists) {
        // Remove the tile
        const filtered = prev.filter((t) => t.type !== tileType);
        return reindex(filtered);
      }
      // Add the tile
      const def = TILE_REGISTRY[tileType];
      const maxOrder = prev.reduce((max, t) => Math.max(max, t.order), -1);
      return reindex([...prev, { type: tileType, width: def.defaultWidth, order: maxOrder + 1 }]);
    });
  }

  function handleMoveUp(tileType: TileType) {
    setWorkingLayout((prev) => {
      const sorted = prev.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((t) => t.type === tileType);
      if (idx <= 0) return prev;
      [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
      return reindex(sorted);
    });
  }

  function handleMoveDown(tileType: TileType) {
    setWorkingLayout((prev) => {
      const sorted = prev.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((t) => t.type === tileType);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
      return reindex(sorted);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      onSave(workingLayout);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col animate-slide-left">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Customize Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Enabled tiles */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">
              Visible Tiles ({enabledTiles.length})
            </h3>
            {enabledTiles.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No tiles visible. Toggle tiles on below.
              </p>
            )}
            <div className="space-y-2">
              {enabledTiles.map((tile) => {
                const def = TILE_REGISTRY[tile.type];
                return (
                  <TileRow
                    key={tile.type}
                    definition={def}
                    enabled
                    onToggle={() => handleToggle(tile.type)}
                  />
                );
              })}
            </div>
          </section>

          {/* Available tiles */}
          {availableTiles.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">
                Add Tiles ({availableTiles.length})
              </h3>
              <div className="space-y-2">
                {availableTiles.map((def) => (
                  <TileRow
                    key={def.type}
                    definition={def}
                    enabled={false}
                    onToggle={() => handleToggle(def.type)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Layout"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── TileRow sub-component ──

interface TileRowProps {
  definition: TileDefinition;
  enabled: boolean;
  onToggle: () => void;
}

function TileRow({ definition, enabled, onToggle }: TileRowProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
        enabled
          ? "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
          : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 opacity-70"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0">{definition.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {definition.label}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {definition.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Toggle switch */}
        <button
          onClick={onToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ml-2 ${
            enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-zinc-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

/** Re-index tile orders to be sequential (0, 1, 2, ...). */
function reindex(tiles: DashboardTileConfig[]): DashboardTileConfig[] {
  return tiles
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({ ...t, order: i }));
}
