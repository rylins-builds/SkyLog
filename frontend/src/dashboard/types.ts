/**
 * Dashboard Tile Types
 *
 * Defines the types used by the customizable dashboard tile system.
 *
 * @module dashboard/types
 */

/** Width that a tile occupies in the grid (1 = 1 column, 2 = 2 columns). */
export type TileWidth = 1 | 2;

/** All available stat tile type identifiers, including all time categories. */
export type TileType =
  | "total-flights"
  | "total-hours"
  | "night-hours"
  | "hours-last-30-days"
  | "total-landings"
  | "unique-aircraft"
  | "sel-time"
  | "ses-time"
  | "mel-time"
  | "mes-time"
  | "helicopter-time"
  | "gyroplane-time"
  | "powered-lift-time"
  | "glider-time"
  | "balloon-time"
  | "airship-time"
  | "solo-time"
  | "pic-time"
  | "sic-time"
  | "dual-time"
  | "instructor-time"
  | "xcountry-time"
  | "act-instrument-time"
  | "sim-instrument-time"
  | "full-flight-simulator-time"
  | "flight-training-device-time"
  | "aviation-training-device-time"
  | "takeoffs-day"
  | "takeoffs-night"
  | "landings-day"
  | "landings-night"
  | "precision-approaches"
  | "non-precision-approaches"
  | "holding-patterns";

/**
 * A tile definition in the user's dashboard layout.
 * Persisted to the backend API per-user.
 */
export interface DashboardTileConfig {
  type: TileType;
  /** 1 = single column, 2 = spans two columns */
  width: TileWidth;
  /** Positional order in the grid */
  order: number;
}
