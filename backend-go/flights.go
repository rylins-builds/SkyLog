package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
)

// registerFlightRoutes adds all flight-related routes to the given mux.
func registerFlightRoutes(mux *http.ServeMux, db *sql.DB) {
	// Flight CRUD
	mux.HandleFunc("GET /api/flights", listFlights(db))
	mux.HandleFunc("POST /api/flights", createFlight(db))
	mux.HandleFunc("GET /api/flights/{id}", getFlight(db))
	mux.HandleFunc("PUT /api/flights/{id}", updateFlight(db))
	mux.HandleFunc("DELETE /api/flights/{id}", deleteFlight(db))
	// Dashboard stats
	mux.HandleFunc("GET /api/dashboard/stats", getDashboardStats(db))
}

// ── Helpers ──

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, map[string]string{"detail": detail})
}

func getUserID(r *http.Request, db *sql.DB) (int, error) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return 0, &httpError{401, "Authorization required"}
	}
	token := strings.TrimPrefix(auth, "Bearer ")
	token = strings.TrimSpace(token)
	if token == "" {
		return 0, &httpError{401, "Authorization required"}
	}

	var userID int
	err := db.QueryRowContext(r.Context(), "SELECT user_id FROM sessions WHERE token = ?", token).Scan(&userID)
	if err == sql.ErrNoRows {
		return 0, &httpError{401, "Invalid or expired token"}
	}
	if err != nil {
		return 0, &httpError{500, "Database error"}
	}
	return userID, nil
}

type httpError struct {
	Code    int
	Message string
}

func (e *httpError) Error() string { return e.Message }

// ── GET /api/flights ──

func listFlights(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			"SELECT * FROM flights WHERE user_id = ? ORDER BY date DESC, id DESC", userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		flights, err := scanFlights(rows)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}
		if flights == nil {
			flights = []Flight{}
		}

		writeJSON(w, 200, flights)
	}
}

// ── GET /api/flights/{id} ──

func getFlight(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		idStr := r.PathValue("id")
		id, _ := strconv.Atoi(idStr)

		f, err := scanFlight(db.QueryRowContext(r.Context(),
			"SELECT * FROM flights WHERE id = ? AND user_id = ?", id, userID))
		if err == sql.ErrNoRows {
			writeError(w, 404, "Flight not found")
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, f)
	}
}

// ── POST /api/flights ──

func createFlight(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var fc FlightCreate
		if err := json.NewDecoder(r.Body).Decode(&fc); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		// Validate
		if valErrs := fc.Validate(); len(valErrs) > 0 {
			writeJSON(w, 422, valErrs)
			return
		}

		// Defaults for optional fields — match Python behaviour
		nightTime := fc.NightTime
		takeoffsDay := fc.TakeoffsDay
		takeoffsNight := fc.TakeoffsNight
		landingsDay := fc.LandingsDay
		landingsNight := fc.LandingsNight
		precisionApproaches := fc.PrecisionApproaches
		nonPrecisionApproaches := fc.NonPrecisionApproaches
		holdingPatterns := fc.HoldingPatterns

		// If these were set to 0 in the request, we should default them.
		// The JSON decoder will set them to 0 if not in the request body.
		// Python's Pydantic defaults these with Field(default=0, ge=0).
		// Since we can't distinguish here (Go zero value = 0), we use
		// the values as-is — they'll be 0 which is what Python would default to.

		result, err := db.ExecContext(r.Context(), `
			INSERT INTO flights (
				user_id, date, aircraft_type, aircraft_reg, departure, arrival,
				departure_time, arrival_time, total_time, sel_time, ses_time, mel_time, mes_time,
				helicopter_time, gyroplane_time, powered_lift_time, glider_time, balloon_time, airship_time, solo_time, pic_time, sic_time, dual_time, instructor_time,
				xcountry_time, night_time, act_instrument_time, sim_instrument_time, sim_time,
				pilot_in_command, remarks, takeoffs_day, takeoffs_night, landings_day,
				landings_night, precision_approaches, non_precision_approaches, holding_patterns
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			userID,
			fc.Date,
			fc.AircraftType,
			fc.AircraftReg,
			fc.Departure,
			fc.Arrival,
			fc.DepartureTime,
			fc.ArrivalTime,
			fc.TotalTime,
			fc.SELTime,
			fc.SESTime,
			fc.MELTime,
			fc.MESTime,
			fc.HelicopterTime,
			fc.GyroplaneTime,
			fc.PoweredLiftTime,
			fc.GliderTime,
			fc.BalloonTime,
			fc.AirshipTime,
			fc.SoloTime,
			fc.PICTime,
			fc.SICTime,
			fc.DualTime,
			fc.InstructorTime,
			fc.XCountryTime,
			nightTime,
			fc.ActInstrumentTime,
			fc.SimInstrumentTime,
			fc.SimTime,
			fc.PilotInCommand,
			fc.Remarks,
			takeoffsDay,
			takeoffsNight,
			landingsDay,
			landingsNight,
			precisionApproaches,
			nonPrecisionApproaches,
			holdingPatterns,
		)
		if err != nil {
			log.Printf("createFlight insert: %v", err)
			writeError(w, 500, "Database error")
			return
		}

		flightID, _ := result.LastInsertId()

		f, err := scanFlight(db.QueryRowContext(r.Context(),
			"SELECT * FROM flights WHERE id = ?", flightID))
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 201, f)
	}
}

// ── PUT /api/flights/{id} ──

func updateFlight(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		idStr := r.PathValue("id")
		flightID, _ := strconv.Atoi(idStr)

		// Verify ownership
		existing, err := scanFlight(db.QueryRowContext(r.Context(),
			"SELECT * FROM flights WHERE id = ? AND user_id = ?", flightID, userID))
		if err == sql.ErrNoRows {
			writeError(w, 404, "Flight not found")
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		var update FlightUpdate
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		// Build dynamic SET clause from non-nil fields.
		// We use a map of column names to values.
		cols := make(map[string]any)

		if update.Date != nil {
			cols["date"] = *update.Date
		}
		if update.AircraftType != nil {
			// Use the named field path from FlightUpdate struct
			cols["aircraft_type"] = *update.AircraftType
		}
		if update.AircraftReg != nil {
			cols["aircraft_reg"] = *update.AircraftReg
		}
		if update.Departure != nil {
			cols["departure"] = *update.Departure
		}
		if update.Arrival != nil {
			cols["arrival"] = *update.Arrival
		}
		if update.DepartureTime != nil {
			cols["departure_time"] = *update.DepartureTime
		}
		if update.ArrivalTime != nil {
			cols["arrival_time"] = *update.ArrivalTime
		}
		if update.TotalTime != nil {
			cols["total_time"] = *update.TotalTime
		}
		if update.SELTime != nil {
			cols["sel_time"] = *update.SELTime
		}
		if update.SESTime != nil {
			cols["ses_time"] = *update.SESTime
		}
		if update.MELTime != nil {
			cols["mel_time"] = *update.MELTime
		}
		if update.MESTime != nil {
			cols["mes_time"] = *update.MESTime
		}
		if update.HelicopterTime != nil {
			cols["helicopter_time"] = *update.HelicopterTime
		}
		if update.GyroplaneTime != nil {
			cols["gyroplane_time"] = *update.GyroplaneTime
		}
		if update.PoweredLiftTime != nil {
			cols["powered_lift_time"] = *update.PoweredLiftTime
		}
		if update.GliderTime != nil {
			cols["glider_time"] = *update.GliderTime
		}
		if update.BalloonTime != nil {
			cols["balloon_time"] = *update.BalloonTime
		}
		if update.AirshipTime != nil {
			cols["airship_time"] = *update.AirshipTime
		}
		if update.SoloTime != nil {
			cols["solo_time"] = *update.SoloTime
		}
		if update.PICTime != nil {
			cols["pic_time"] = *update.PICTime
		}
		if update.SICTime != nil {
			cols["sic_time"] = *update.SICTime
		}
		if update.DualTime != nil {
			cols["dual_time"] = *update.DualTime
		}
		if update.InstructorTime != nil {
			cols["instructor_time"] = *update.InstructorTime
		}
		if update.XCountryTime != nil {
			cols["xcountry_time"] = *update.XCountryTime
		}
		if update.NightTime != nil {
			cols["night_time"] = *update.NightTime
		}
		if update.ActInstrumentTime != nil {
			cols["act_instrument_time"] = *update.ActInstrumentTime
		}
		if update.SimInstrumentTime != nil {
			cols["sim_instrument_time"] = *update.SimInstrumentTime
		}
		if update.SimTime != nil {
			cols["sim_time"] = *update.SimTime
		}
		if update.PilotInCommand != nil {
			cols["pilot_in_command"] = *update.PilotInCommand
		}
		if update.Remarks != nil {
			cols["remarks"] = *update.Remarks
		}
		if update.TakeoffsDay != nil {
			cols["takeoffs_day"] = *update.TakeoffsDay
		}
		if update.TakeoffsNight != nil {
			cols["takeoffs_night"] = *update.TakeoffsNight
		}
		if update.LandingsDay != nil {
			cols["landings_day"] = *update.LandingsDay
		}
		if update.LandingsNight != nil {
			cols["landings_night"] = *update.LandingsNight
		}
		if update.PrecisionApproaches != nil {
			cols["precision_approaches"] = *update.PrecisionApproaches
		}
		if update.NonPrecisionApproaches != nil {
			cols["non_precision_approaches"] = *update.NonPrecisionApproaches
		}
		if update.HoldingPatterns != nil {
			cols["holding_patterns"] = *update.HoldingPatterns
		}

		if len(cols) == 0 {
			// No fields to update — return existing record unchanged
			writeJSON(w, 200, existing)
			return
		}

		// Build SET clause
		parts := make([]string, 0, len(cols))
		args := make([]any, 0, len(cols)+1)
		for col, val := range cols {
			parts = append(parts, col+" = ?")
			args = append(args, val)
		}
		args = append(args, flightID)

		query := "UPDATE flights SET " + strings.Join(parts, ", ") + " WHERE id = ?"
		if _, err := db.ExecContext(r.Context(), query, args...); err != nil {
			log.Printf("updateFlight: %v", err)
			writeError(w, 500, "Database error")
			return
		}

		f, err := scanFlight(db.QueryRowContext(r.Context(),
			"SELECT * FROM flights WHERE id = ?", flightID))
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, f)
	}
}

// ── DELETE /api/flights/{id} ──

func deleteFlight(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		idStr := r.PathValue("id")
		flightID, _ := strconv.Atoi(idStr)

		result, err := db.ExecContext(r.Context(),
			"DELETE FROM flights WHERE id = ? AND user_id = ?", flightID, userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeError(w, 404, "Flight not found")
			return
		}

		w.WriteHeader(204)
	}
}

// ── GET /api/dashboard/stats ──

func getDashboardStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var stats DashboardStats

		row := db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&stats.TotalFlights); err != nil {
			writeError(w, 500, "Database error")
			return
		}

		var totalHours, totalNight, hours30 float64
		row = db.QueryRowContext(r.Context(), "SELECT COALESCE(SUM(total_time), 0) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&totalHours); err != nil {
			writeError(w, 500, "Database error")
			return
		}
		stats.TotalHours = math.Round(totalHours*100) / 100

		row = db.QueryRowContext(r.Context(), "SELECT COALESCE(SUM(night_time), 0) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&totalNight); err != nil {
			writeError(w, 500, "Database error")
			return
		}
		stats.TotalNightHours = math.Round(totalNight*100) / 100

		row = db.QueryRowContext(r.Context(), `
			SELECT COALESCE(SUM(total_time), 0) FROM flights 
			WHERE user_id = ? AND date >= date('now', '-30 days')`, userID)
		if err := row.Scan(&hours30); err != nil {
			writeError(w, 500, "Database error")
			return
		}
		stats.HoursLast30Days = math.Round(hours30*100) / 100

		row = db.QueryRowContext(r.Context(),
			"SELECT COALESCE(SUM(landings_day + landings_night), 0) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&stats.TotalLandings); err != nil {
			writeError(w, 500, "Database error")
			return
		}

		row = db.QueryRowContext(r.Context(),
			"SELECT COUNT(DISTINCT aircraft_reg) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&stats.UniqueAircraft); err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, stats)
	}
}
