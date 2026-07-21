/**
 * SkyLog Type Definitions
 *
 * This file defines all TypeScript interfaces used across the frontend
 * to represent data returned from or sent to the backend API.
 *
 * These types mirror the backend's Pydantic schemas (defined in
 * backend/app/schemas.py) to ensure end-to-end type safety between
 * API responses and UI components. Whenever the backend schema changes,
 * this file must be updated in tandem.
 *
 * Naming convention: all property names use **snake_case** to match
 * the JSON field names returned by the Python FastAPI backend.
 *
 * @module api/types
 */

/**
 * A complete flight record as returned by the API.
 * Every property name follows snake_case to match the backend's
 * FlightResponse Pydantic model.
 */
export interface Flight {
  /** Unique database identifier (auto-increment) */
  id: number;
  /** Flight date in YYYY-MM-DD format */
  date: string;
  /** Name of the pilot in command */
  pilot_in_command: string;
  /** Aircraft make/model (e.g. "Cessna 172S") */
  aircraft_type: string;
  /** Aircraft tail number / registration (e.g. "N2860Q") */
  aircraft_reg: string;
  /** Departure airport ICAO code */
  departure: string;
  /** Arrival airport ICAO code */
  arrival: string;
  /** Departure time in Zulu (HH:MM format), nullable */
  departure_time: string | null;
  /** Arrival time in Zulu (HH:MM format), nullable */
  arrival_time: string | null;
  /** Total flight time in hours */
  total_time: number;
  /** Single Engine Land time (hours) */
  sel_time: number;
  /** Single Engine Sea time (hours) */
  ses_time: number;
  /** Multi Engine Land time (hours) */
  mel_time: number;
  /** Multi Engine Sea time (hours) */
  mes_time: number;
  /** Helicopter time (hours) */
  helicopter_time: number;
  /** Gyroplane time (hours) */
  gyroplane_time: number;
  /** Powered Lift time (hours) */
  powered_lift_time: number;
  /** Glider time (hours) */
  glider_time: number;
  /** Balloon time (hours) */
  balloon_time: number;
  /** Airship time (hours) */
  airship_time: number;
  /** Solo flight time (hours) */
  solo_time: number;
  /** Pilot-in-Command time (hours) */
  pic_time: number;
  /** Second-in-Command time (hours) */
  sic_time: number;
  /** Dual instruction received time (hours) */
  dual_time: number;
  /** Instructor time (hours) */
  instructor_time: number;
  /** Cross-country time (hours) */
  xcountry_time: number;
  /** Night flight time (hours) */
  night_time: number;
  /** Actual instrument flight time (hours) — flown in actual IMC conditions */
  act_instrument_time: number;
  /** Simulated instrument (hood / foggles) time (hours) */
  sim_instrument_time: number;
  /** Full flight simulator time (hours) */
  full_flight_simulator_time: number;
  /** Flight training device time (hours) */
  flight_training_device_time: number;
  /** Aviation training device time (hours) */
  aviation_training_device_time: number;
  /** Number of day takeoffs */
  takeoffs_day: number;
  /** Number of night takeoffs */
  takeoffs_night: number;
  /** Number of day landings */
  landings_day: number;
  /** Number of night landings */
  landings_night: number;
  /** Number of precision instrument approaches (e.g. ILS, PAR) */
  precision_approaches: number;
  /** Number of non-precision instrument approaches (e.g. VOR, GPS LNAV) */
  non_precision_approaches: number;
  /** Number of holding pattern entries */
  holding_patterns: number;
  /** Launch type (aero_tow, ground_launch, powered_launch) */
  launch_type: string | null;
  /** Free-text remarks or notes about the flight */
  remarks: string | null;
  /** Timestamp of when the record was created (ISO 8601 string) */
  created_at: string;
}

/**
 * Payload for creating or updating a flight record.
 *
 * Most numeric time fields default to 0 on the backend if omitted —
 * only total_time is required (> 0) in the create schema.
 * For updates, use Partial<FlightCreate> (all fields optional).
 */
export interface FlightCreate {
  /** Flight date in YYYY-MM-DD format */
  date: string;
  /** Name of the pilot in command */
  pilot_in_command: string;
  /** Aircraft make/model (e.g. "Cessna 172S") */
  aircraft_type: string;
  /** Aircraft tail number / registration */
  aircraft_reg: string;
  /** Departure airport ICAO code */
  departure: string;
  /** Arrival airport ICAO code */
  arrival: string;
  /** Departure time in Zulu (HH:MM), nullable */
  departure_time?: string | null;
  /** Arrival time in Zulu (HH:MM), nullable */
  arrival_time?: string | null;
  /** Total flight time in hours (must be > 0) */
  total_time: number;
  /** Single Engine Land time (hours) */
  sel_time: number;
  /** Single Engine Sea time (hours) */
  ses_time: number;
  /** Multi Engine Land time (hours) */
  mel_time: number;
  /** Multi Engine Sea time (hours) */
  mes_time: number;
  /** Helicopter time (hours) */
  helicopter_time: number;
  /** Gyroplane time (hours) */
  gyroplane_time: number;
  /** Powered Lift time (hours) */
  powered_lift_time: number;
  /** Glider time (hours) */
  glider_time: number;
  /** Balloon time (hours) */
  balloon_time: number;
  /** Airship time (hours) */
  airship_time: number;
  /** Solo flight time (hours) */
  solo_time: number;
  /** Pilot-in-Command time (hours) */
  pic_time: number;
  /** Second-in-Command time (hours) */
  sic_time: number;
  /** Dual instruction received time (hours) */
  dual_time: number;
  /** Instructor time (hours) */
  instructor_time: number;
  /** Cross-country time (hours) */
  xcountry_time: number;
  /** Night flight time (hours) */
  night_time?: number;
  /** Actual instrument flight time (hours) */
  act_instrument_time: number;
  /** Simulated instrument (hood) time (hours) */
  sim_instrument_time: number;
  /** Full flight simulator time (hours) */
  full_flight_simulator_time: number;
  /** Flight training device time (hours) */
  flight_training_device_time: number;
  /** Aviation training device time (hours) */
  aviation_training_device_time: number;
  
  /** Number of day takeoffs */
  takeoffs_day: number;
  /** Number of night takeoffs */
  takeoffs_night: number;
  /** Number of day landings */
  landings_day?: number;
  /** Number of night landings */
  landings_night?: number;
  /** Number of precision instrument approaches */
  precision_approaches?: number;
  /** Number of non-precision instrument approaches */
  non_precision_approaches?: number;
  /** Number of holding pattern entries */
  holding_patterns?: number;
  /** Launch type (aero_tow, ground_launch, powered_launch) */
  launch_type?: string | null;
  /** Free-text remarks or notes */
  remarks?: string | null;
}

/**
 * A file attachment associated with a flight log entry.
 */
export interface Attachment {
  /** Unique database identifier (auto-increment) */
  id: number;
  /** The flight this attachment belongs to */
  flight_id: number;
  /** Original filename as uploaded */
  filename: string;
  /** MIME type of the file */
  content_type: string;
  /** File size in bytes */
  size: number;
  /** Timestamp of when the file was uploaded (ISO 8601 string) */
  created_at: string;
}

/**
 * Aggregated statistics for a single aircraft type.
 * Returned by GET /api/dashboard/aircraft-type-stats.
 */
export interface AircraftTypeStat {
  /** Aircraft make/model (e.g. "Cessna 172S") */
  aircraft_type: string;
  /** Total flight time in this aircraft type (hours) */
  total_hours: number;
  /** Number of flights in this aircraft type */
  flight_count: number;
  /** Days since the most recent flight in this type */
  days_since_last_flight: number;
  /** Single Engine Land time in this type (hours) */
  sel_time: number;
  /** Single Engine Sea time in this type (hours) */
  ses_time: number;
  /** Multi Engine Land time in this type (hours) */
  mel_time: number;
  /** Multi Engine Sea time in this type (hours) */
  mes_time: number;
  /** Helicopter time in this type (hours) */
  helicopter_time: number;
  /** Gyroplane time in this type (hours) */
  gyroplane_time: number;
  /** Powered Lift time in this type (hours) */
  powered_lift_time: number;
  /** Glider time in this type (hours) */
  glider_time: number;
  /** Balloon time in this type (hours) */
  balloon_time: number;
  /** Airship time in this type (hours) */
  airship_time: number;
  /** Solo flight time in this type (hours) */
  solo_time: number;
  /** Pilot-in-Command time in this type (hours) */
  pic_time: number;
  /** Second-in-Command time in this type (hours) */
  sic_time: number;
  /** Dual instruction received time in this type (hours) */
  dual_time: number;
  /** Instructor time in this type (hours) */
  instructor_time: number;
  /** Cross-country time in this type (hours) */
  xcountry_time: number;
  /** Night flight time in this type (hours) */
  night_time: number;
  /** Actual instrument time in this type (hours) */
  act_instrument_time: number;
  /** Simulated instrument time in this type (hours) */
  sim_instrument_time: number;
  /** Full flight simulator time in this type (hours) */
  full_flight_simulator_time: number;
  /** Flight training device time in this type (hours) */
  flight_training_device_time: number;
  /** Aviation training device time in this type (hours) */
  aviation_training_device_time: number;
  /** Number of day takeoffs in this type */
  takeoffs_day: number;
  /** Number of night takeoffs in this type */
  takeoffs_night: number;
  /** Number of day landings in this type */
  landings_day: number;
  /** Number of night landings in this type */
  landings_night: number;
  /** Number of precision approaches in this type */
  precision_approaches: number;
  /** Number of non-precision approaches in this type */
  non_precision_approaches: number;
  /** Number of holding patterns in this type */
  holding_patterns: number;
}

export interface DashboardStats {
  /** Total number of flights logged */
  total_flights: number;
  /** Total flight time across all entries (hours) */
  total_hours: number;
  /** Total night flight time (hours) */
  total_night_hours: number;
  /** Total flight time in the last 30 days (hours) */
  hours_last_30_days: number;
  /** Combined day + night landings */
  total_landings: number;
  /** Number of unique aircraft registrations flown */
  unique_aircraft: number;
  /** Single Engine Land time (hours) */
  sel_time: number;
  /** Single Engine Sea time (hours) */
  ses_time: number;
  /** Multi Engine Land time (hours) */
  mel_time: number;
  /** Multi Engine Sea time (hours) */
  mes_time: number;
  /** Helicopter time (hours) */
  helicopter_time: number;
  /** Gyroplane time (hours) */
  gyroplane_time: number;
  /** Powered Lift time (hours) */
  powered_lift_time: number;
  /** Glider time (hours) */
  glider_time: number;
  /** Balloon time (hours) */
  balloon_time: number;
  /** Airship time (hours) */
  airship_time: number;
  /** Solo flight time (hours) */
  solo_time: number;
  /** Pilot-in-Command time (hours) */
  pic_time: number;
  /** Second-in-Command time (hours) */
  sic_time: number;
  /** Dual instruction received time (hours) */
  dual_time: number;
  /** Instructor time (hours) */
  instructor_time: number;
  /** Cross-country time (hours) */
  xcountry_time: number;
  /** Actual instrument flight time (hours) — flown in actual IMC conditions */
  act_instrument_time: number;
  /** Simulated instrument (hood / foggles) time (hours) */
  sim_instrument_time: number;
  /** Full flight simulator time (hours) */
  full_flight_simulator_time: number;
  /** Flight training device time (hours) */
  flight_training_device_time: number;
  /** Aviation training device time (hours) */
  aviation_training_device_time: number;
  /** Number of day takeoffs */
  takeoffs_day: number;
  /** Number of night takeoffs */
  takeoffs_night: number;
  /** Number of day landings */
  landings_day: number;
  /** Number of night landings */
  landings_night: number;
  /** Number of precision instrument approaches (e.g. ILS, PAR) */
  precision_approaches: number;
  /** Number of non-precision instrument approaches (e.g. VOR, GPS LNAV) */
  non_precision_approaches: number;
  /** Number of holding pattern entries */
  holding_patterns: number;
}
