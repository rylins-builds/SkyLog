/** Flight types for SkyLog frontend */

export interface Flight {
  id: number;
  date: string;
  aircraft_type: string;
  aircraft_reg: string;
  departure: string;
  arrival: string;
  departure_time: string | null;
  arrival_time: string | null;
  total_time: number;
  pic_time: number;
  sic_time: number;
  dual_time: number;
  instructor_time: number;
  xcountry_time: number;
  night_time: number;
  pilot_in_command: string;
  remarks: string | null;
  takeoffs_day: number;
  takeoffs_night: number;
  landings_day: number;
  landings_night: number;
  cross_country: boolean;
  created_at: string;
}

export interface FlightCreate {
  date: string;
  aircraft_type: string;
  aircraft_reg: string;
  departure: string;
  arrival: string;
  departure_time?: string | null;
  arrival_time?: string | null;
  total_time: number;
  pic_time: number;
  sic_time: number;
  dual_time: number;
  instructor_time: number;
  xcountry_time: number;
  night_time?: number;
  pilot_in_command: string;
  remarks?: string | null;
  takeoffs_day: number;
  takeoffs_night: number;
  landings_day?: number;
  landings_night?: number;
  cross_country?: boolean;
}

export interface DashboardStats {
  total_flights: number;
  total_hours: number;
  total_night_hours: number;
  hours_last_30_days: number;
  total_landings: number;
  unique_aircraft: number;
}
