/**
 * Dashboard Tile Registry
 *
 * Central registry of all available dashboard tile types. Each tile
 * has metadata (label, icon, description, default width) and a
 * reference to the React component that renders it.
 *
 * Adding a new tile type requires:
 *   1. Adding its identifier to the `TileType` union in types.ts.
 *   2. Creating a component in tiles/.
 *   3. Registering it here in `TILE_REGISTRY`.
 *
 * @module dashboard/tileRegistry
 */

import type { TileType, TileWidth } from "./types";
import type { ComponentType } from "react";

/** Metadata about an available tile. */
export interface TileDefinition {
  type: TileType;
  /** Human-readable label shown in the customizer and as default card title. */
  label: string;
  /** Emoji or SVG icon identifier. */
  icon: string;
  /** Short description of what the tile displays. */
  description: string;
  /** Default grid width when the tile is first added. */
  defaultWidth: TileWidth;
  /** The React component that renders this tile. */
  component: ComponentType<TileComponentProps>;
  /** Whether this tile is enabled by default for new users. */
  enabledByDefault: boolean;
}

/** Props passed to every tile component. */
export interface TileComponentProps {
  /** The tile's configuration. */
  config: { type: TileType; width: TileWidth; order: number };
}

/**
 * Registry: tile type → TileDefinition.
 *
 * Each tile component receives a `TileComponentProps` object containing
 * its config. Components are responsible for fetching their own data
 * or receiving it via context/props from the parent.
 */
export const TILE_REGISTRY: Record<TileType, TileDefinition> = {
  "total-flights": {
    type: "total-flights",
    label: "Total Flights",
    icon: "📊",
    description: "Total number of flights logged",
    defaultWidth: 1,
    component: () => null, // placeholder — rendered inline by Dashboard
    enabledByDefault: true,
  },
  "total-hours": {
    type: "total-hours",
    label: "Total Hours",
    icon: "⏱️",
    description: "Total flight time across all entries",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "night-hours": {
    type: "night-hours",
    label: "Night Hours",
    icon: "🌙",
    description: "Total night flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "hours-last-30-days": {
    type: "hours-last-30-days",
    label: "Hours (Last 30 Days)",
    icon: "📅",
    description: "Flight time logged in the last 30 days",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "total-landings": {
    type: "total-landings",
    label: "Total Landings",
    icon: "🛬",
    description: "Combined day and night landings",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "unique-aircraft": {
    type: "unique-aircraft",
    label: "Unique Aircraft",
    icon: "🛩️",
    description: "Number of unique aircraft registrations flown",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "recent-flights": {
    type: "recent-flights",
    label: "Recent Flights",
    icon: "📋",
    description: "Your 5 most recent flight entries",
    defaultWidth: 2,
    component: () => null,
    enabledByDefault: true,
  },
};

/**
 * Return the default layout for a new user (all enabled tiles in order).
 */
export function getDefaultLayout() {
  return Object.values(TILE_REGISTRY)
    .filter((t) => t.enabledByDefault)
    .sort((a, b) => a.type.localeCompare(b.type))
    .map((t, i) => ({
      type: t.type,
      width: t.defaultWidth,
      order: i,
    }));
}
