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
    component: () => null,
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
  "sel-time": {
    type: "sel-time",
    label: "SEL Time",
    icon: "🛫",
    description: "Single Engine Land time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "ses-time": {
    type: "ses-time",
    label: "SES Time",
    icon: "🌊",
    description: "Single Engine Sea time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "mel-time": {
    type: "mel-time",
    label: "MEL Time",
    icon: "🛩️",
    description: "Multi Engine Land time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "mes-time": {
    type: "mes-time",
    label: "MES Time",
    icon: "🌊",
    description: "Multi Engine Sea time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "helicopter-time": {
    type: "helicopter-time",
    label: "Helicopter Time",
    icon: "🚁",
    description: "Total helicopter flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "gyroplane-time": {
    type: "gyroplane-time",
    label: "Gyroplane Time",
    icon: "🔄",
    description: "Total gyroplane flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "powered-lift-time": {
    type: "powered-lift-time",
    label: "Powered Lift Time",
    icon: "⬆️",
    description: "Total powered-lift flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "glider-time": {
    type: "glider-time",
    label: "Glider Time",
    icon: "🪂",
    description: "Total glider flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "balloon-time": {
    type: "balloon-time",
    label: "Balloon Time",
    icon: "🎈",
    description: "Total balloon flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "airship-time": {
    type: "airship-time",
    label: "Airship Time",
    icon: "🏮",
    description: "Total airship flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "solo-time": {
    type: "solo-time",
    label: "Solo Time",
    icon: "🧑‍✈️",
    description: "Total solo flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "pic-time": {
    type: "pic-time",
    label: "PIC Time",
    icon: "👨‍✈️",
    description: "Pilot-in-Command time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "sic-time": {
    type: "sic-time",
    label: "SIC Time",
    icon: "👨‍✈️",
    description: "Second-in-Command time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "dual-time": {
    type: "dual-time",
    label: "Dual Time",
    icon: "📖",
    description: "Dual instruction received time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "instructor-time": {
    type: "instructor-time",
    label: "Instructor Time",
    icon: "🎓",
    description: "Time acting as instructor",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "xcountry-time": {
    type: "xcountry-time",
    label: "Cross-Country Time",
    icon: "🗺️",
    description: "Total cross-country flight time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: true,
  },
  "act-instrument-time": {
    type: "act-instrument-time",
    label: "Actual Instrument",
    icon: "☁️",
    description: "Actual instrument flight time (IMC)",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "sim-instrument-time": {
    type: "sim-instrument-time",
    label: "Simulated Instrument",
    icon: "🕶️",
    description: "Simulated instrument (hood) time",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "full-flight-simulator-time": {
    type: "full-flight-simulator-time",
    label: "Full Flight Simulator",
    icon: "🖥️",
    description: "Full flight simulator time (FFS)",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "flight-training-device-time": {
    type: "flight-training-device-time",
    label: "FTD Time",
    icon: "💻",
    description: "Flight training device time (FTD)",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "aviation-training-device-time": {
    type: "aviation-training-device-time",
    label: "ATD Time",
    icon: "📱",
    description: "Aviation training device time (ATD)",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "takeoffs-day": {
    type: "takeoffs-day",
    label: "Day Takeoffs",
    icon: "🌅",
    description: "Total number of day takeoffs",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "takeoffs-night": {
    type: "takeoffs-night",
    label: "Night Takeoffs",
    icon: "🌃",
    description: "Total number of night takeoffs",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "landings-day": {
    type: "landings-day",
    label: "Day Landings",
    icon: "🛬",
    description: "Total number of day landings",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "landings-night": {
    type: "landings-night",
    label: "Night Landings",
    icon: "🌙",
    description: "Total number of night landings",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "precision-approaches": {
    type: "precision-approaches",
    label: "Precision Approaches",
    icon: "🎯",
    description: "Total precision instrument approaches (ILS, PAR)",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "non-precision-approaches": {
    type: "non-precision-approaches",
    label: "Non-Precision Approaches",
    icon: "🧭",
    description: "Total non-precision instrument approaches (VOR, GPS)",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  "holding-patterns": {
    type: "holding-patterns",
    label: "Holding Patterns",
    icon: "🔄",
    description: "Total holding pattern entries",
    defaultWidth: 1,
    component: () => null,
    enabledByDefault: false,
  },
  // Note: Recent Flights is rendered as a static section below the
  // customizable stat tiles. It is not a tile in the customization system.
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
