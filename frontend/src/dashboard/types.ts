/**
 * Dashboard Tile Types
 *
 * Defines the types used by the customizable dashboard tile system.
 *
 * @module dashboard/types
 */

/** Width that a tile occupies in the grid (1 = 1 column, 2 = 2 columns). */
export type TileWidth = 1 | 2;

/** All available tile type identifiers. */
export type TileType =
  | "total-flights"
  | "total-hours"
  | "night-hours"
  | "hours-last-30-days"
  | "total-landings"
  | "unique-aircraft"
  | "recent-flights";

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
