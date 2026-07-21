package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// registerFlightRoutes adds all flight-related routes to the given mux.
func registerFlightRoutes(mux *http.ServeMux, db *sql.DB) {
	// Flight CRUD
	mux.HandleFunc("GET /api/flights", listFlights(db))
	mux.HandleFunc("POST /api/flights", createFlight(db))
	mux.HandleFunc("GET /api/flights/{id}", getFlight(db))
	mux.HandleFunc("PUT /api/flights/{id}", updateFlight(db))
	mux.HandleFunc("DELETE /api/flights/{id}", deleteFlight(db))
	mux.HandleFunc("DELETE /api/flights", wipeFlights(db))
	// Dashboard stats
	mux.HandleFunc("GET /api/dashboard/stats", getDashboardStats(db))
	mux.HandleFunc("GET /api/dashboard/aircraft-type-stats", getAircraftTypeStats(db))
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

// parseFlightPayload reads the flight JSON from the request. If the request is
// multipart/form-data, the flight payload is expected in the "flight" field and
// the returned multipart form contains any uploaded files (under the "files"
// key). For plain application/json requests the multipart form is nil.
func parseFlightPayload(w http.ResponseWriter, r *http.Request, v any) (*multipart.Form, error) {
	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart/form-data") {
		// Allow a generous body budget: JSON payload plus up to several 25 MB files.
		r.Body = http.MaxBytesReader(w, r.Body, 4*maxAttachmentSize+1<<20)
		if err := r.ParseMultipartForm(maxAttachmentUploadMem); err != nil {
			return nil, &httpError{422, "Payload too large or invalid multipart form (max 25 MB per file)"}
		}
		flightJSON := r.FormValue("flight")
		if flightJSON == "" {
			return nil, &httpError{422, "Missing flight field"}
		}
		if err := json.Unmarshal([]byte(flightJSON), v); err != nil {
			return nil, &httpError{422, "Invalid flight JSON"}
		}
		var form *multipart.Form
		if r.MultipartForm != nil {
			form = r.MultipartForm
		}
		return form, nil
	}

	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return nil, &httpError{422, "Invalid JSON body"}
	}
	return nil, nil
}

// saveFlightAttachments persists all files uploaded under the "files" key of a
// multipart flight request. Returns the saved attachment records.
func saveFlightAttachments(r *http.Request, db *sql.DB, form *multipart.Form, flightID, userID int) ([]Attachment, error) {
	saved := []Attachment{}
	if form == nil {
		return saved, nil
	}
	for _, header := range form.File["files"] {
		a, err := saveAttachmentFile(r, db, flightID, userID, header)
		if err != nil {
			// Roll back any files already saved in this batch.
			for _, prev := range saved {
				removeAttachmentRecord(db, prev)
			}
			return nil, err
		}
		saved = append(saved, *a)
	}
	return saved, nil
}

// removeAttachmentRecord deletes an attachment row and its file on disk.
// Used to roll back partially saved batches.
func removeAttachmentRecord(db *sql.DB, a Attachment) {
	var ownerID int
	if err := db.QueryRow("SELECT user_id FROM attachments WHERE id = ?", a.ID).Scan(&ownerID); err != nil {
		return
	}
	db.Exec("DELETE FROM attachments WHERE id = ?", a.ID)
	p := filepath.Join(attachmentsBaseDir(), strconv.Itoa(ownerID), strconv.Itoa(a.FlightID),
		fmt.Sprintf("%d_%s", a.ID, a.Filename))
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		log.Printf("removeAttachmentRecord remove %s: %v", p, err)
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
		multipartForm, err := parseFlightPayload(w, r, &fc)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
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

		result, err := db.ExecContext(r.Context(), `
			INSERT INTO flights (
				user_id, date, pilot_in_command, aircraft_type, aircraft_reg, departure, arrival,
				departure_time, arrival_time, total_time, sel_time, ses_time, mel_time, mes_time,
				helicopter_time, gyroplane_time, powered_lift_time, glider_time, balloon_time, airship_time, solo_time, pic_time, sic_time, dual_time, instructor_time,
				xcountry_time, night_time, act_instrument_time, sim_instrument_time,
				full_flight_simulator_time, flight_training_device_time, aviation_training_device_time,
				takeoffs_day, takeoffs_night, landings_day,
				landings_night, precision_approaches, non_precision_approaches, holding_patterns, launch_type, remarks
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			userID,
			fc.Date,
			fc.PilotInCommand,
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
			fc.FullFlightSimulatorTime,
			fc.FlightTrainingDeviceTime,
			fc.AviationTrainingDeviceTime,
			takeoffsDay,
			takeoffsNight,
			landingsDay,
			landingsNight,
			precisionApproaches,
			nonPrecisionApproaches,
			holdingPatterns,
			fc.LaunchType,
			fc.Remarks,
		)
		if err != nil {
			log.Printf("createFlight insert: %v", err)
			writeError(w, 500, "Database error")
			return
		}

		flightID, _ := result.LastInsertId()

		// Persist any attachments bundled with the create request. If saving
		// fails, roll back the flight so the entry and its files stay in sync.
		if _, err := saveFlightAttachments(r, db, multipartForm, int(flightID), userID); err != nil {
			db.ExecContext(r.Context(), "DELETE FROM flights WHERE id = ?", flightID)
			if he, ok := err.(*httpError); ok {
				writeError(w, he.Code, he.Message)
			} else {
				writeError(w, 500, "Failed to store attachments")
			}
			return
		}

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
		if err := flightOwnedBy(r, db, flightID, userID); err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var update FlightUpdate
		multipartForm, err := parseFlightPayload(w, r, &update)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		// Build dynamic SET clause from non-nil fields.
		cols := make(map[string]any)

		if update.Date != nil {
			cols["date"] = *update.Date
		}
		if update.PilotInCommand != nil {
			cols["pilot_in_command"] = *update.PilotInCommand
		}
		if update.AircraftType != nil {
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
		if update.FullFlightSimulatorTime != nil {
			cols["full_flight_simulator_time"] = *update.FullFlightSimulatorTime
		}
		if update.FlightTrainingDeviceTime != nil {
			cols["flight_training_device_time"] = *update.FlightTrainingDeviceTime
		}
		if update.AviationTrainingDeviceTime != nil {
			cols["aviation_training_device_time"] = *update.AviationTrainingDeviceTime
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
		if update.LaunchType != nil {
			cols["launch_type"] = *update.LaunchType
		}
		if update.Remarks != nil {
			cols["remarks"] = *update.Remarks
		}

		// Persist any attachments bundled with the update request.
		savedAttachments, attErr := saveFlightAttachments(r, db, multipartForm, flightID, userID)

		if len(cols) > 0 {
			parts := make([]string, 0, len(cols))
			args := make([]any, 0, len(cols)+1)
			for col, val := range cols {
				parts = append(parts, col+" = ?")
				args = append(args, val)
			}
			args = append(args, flightID)

			query := "UPDATE flights SET " + strings.Join(parts, ", ") + " WHERE id = ?"
			if _, err := db.ExecContext(r.Context(), query, args...); err != nil {
				// Roll back attachments saved in this request so the flight row
				// and its files stay in sync.
				for _, prev := range savedAttachments {
					removeAttachmentRecord(db, prev)
				}
				log.Printf("updateFlight: %v", err)
				writeError(w, 500, "Database error")
				return
			}
		}

		if attErr != nil {
			if he, ok := attErr.(*httpError); ok {
				writeError(w, he.Code, he.Message)
			} else {
				writeError(w, 500, "Failed to store attachments")
			}
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

		// Remove any attachments (rows + files) for this flight.
		deleteAttachmentsForFlight(db, flightID)

		w.WriteHeader(204)
	}
}

// ── DELETE /api/flights (wipe all flights for user) ──

func wipeFlights(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		// Collect flight IDs first so we can remove their attachments.
		idRows, err := db.QueryContext(r.Context(),
			"SELECT id FROM flights WHERE user_id = ?", userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}
		var flightIDs []int
		for idRows.Next() {
			var id int
			if err := idRows.Scan(&id); err == nil {
				flightIDs = append(flightIDs, id)
			}
		}
		idRows.Close()

		result, err := db.ExecContext(r.Context(),
			"DELETE FROM flights WHERE user_id = ?", userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		for _, id := range flightIDs {
			deleteAttachmentsForFlight(db, id)
		}

		count, _ := result.RowsAffected()
		writeJSON(w, 200, map[string]any{"deleted": count})
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

		row = db.QueryRowContext(r.Context(), "SELECT COALESCE(SUM(total_time), 0) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&stats.TotalHours); err != nil {
			writeError(w, 500, "Database error")
			return
		}
		stats.TotalHours = math.Round(stats.TotalHours*100) / 100

		row = db.QueryRowContext(r.Context(), "SELECT COALESCE(SUM(night_time), 0) FROM flights WHERE user_id = ?", userID)
		if err := row.Scan(&stats.TotalNightHours); err != nil {
			writeError(w, 500, "Database error")
			return
		}
		stats.TotalNightHours = math.Round(stats.TotalNightHours*100) / 100

		row = db.QueryRowContext(r.Context(), `
			SELECT COALESCE(SUM(total_time), 0) FROM flights 
			WHERE user_id = ? AND date >= date('now', '-30 days')`, userID)
		if err := row.Scan(&stats.HoursLast30Days); err != nil {
			writeError(w, 500, "Database error")
			return
		}
		stats.HoursLast30Days = math.Round(stats.HoursLast30Days*100) / 100

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

		// ── Expanded time category aggregates ──
		// Use a single query for all SUM fields for efficiency
		row = db.QueryRowContext(r.Context(), `
			SELECT
				COALESCE(SUM(sel_time), 0),
				COALESCE(SUM(ses_time), 0),
				COALESCE(SUM(mel_time), 0),
				COALESCE(SUM(mes_time), 0),
				COALESCE(SUM(helicopter_time), 0),
				COALESCE(SUM(gyroplane_time), 0),
				COALESCE(SUM(powered_lift_time), 0),
				COALESCE(SUM(glider_time), 0),
				COALESCE(SUM(balloon_time), 0),
				COALESCE(SUM(airship_time), 0),
				COALESCE(SUM(solo_time), 0),
				COALESCE(SUM(pic_time), 0),
				COALESCE(SUM(sic_time), 0),
				COALESCE(SUM(dual_time), 0),
				COALESCE(SUM(instructor_time), 0),
				COALESCE(SUM(xcountry_time), 0),
				COALESCE(SUM(act_instrument_time), 0),
				COALESCE(SUM(sim_instrument_time), 0),
				COALESCE(SUM(full_flight_simulator_time), 0),
				COALESCE(SUM(flight_training_device_time), 0),
				COALESCE(SUM(aviation_training_device_time), 0),
				COALESCE(SUM(takeoffs_day), 0),
				COALESCE(SUM(takeoffs_night), 0),
				COALESCE(SUM(landings_day), 0),
				COALESCE(SUM(landings_night), 0),
				COALESCE(SUM(precision_approaches), 0),
				COALESCE(SUM(non_precision_approaches), 0),
				COALESCE(SUM(holding_patterns), 0)
			FROM flights WHERE user_id = ?`, userID)
		if err := row.Scan(
			&stats.SELTime, &stats.SESTime, &stats.MELTime, &stats.MESTime,
			&stats.HelicopterTime, &stats.GyroplaneTime, &stats.PoweredLiftTime,
			&stats.GliderTime, &stats.BalloonTime, &stats.AirshipTime,
			&stats.SoloTime, &stats.PICTime, &stats.SICTime,
			&stats.DualTime, &stats.InstructorTime, &stats.XCountryTime,
			&stats.ActInstrumentTime, &stats.SimInstrumentTime,
			&stats.FullFlightSimulatorTime, &stats.FlightTrainingDeviceTime, &stats.AviationTrainingDeviceTime,
			&stats.TakeoffsDay, &stats.TakeoffsNight,
			&stats.LandingsDay, &stats.LandingsNight,
			&stats.PrecisionApproaches, &stats.NonPrecisionApproaches,
			&stats.HoldingPatterns,
		); err != nil {
			writeError(w, 500, "Database error")
			return
		}

		// Round all float fields to 2 decimal places
		stats.SELTime = math.Round(stats.SELTime*100) / 100
		stats.SESTime = math.Round(stats.SESTime*100) / 100
		stats.MELTime = math.Round(stats.MELTime*100) / 100
		stats.MESTime = math.Round(stats.MESTime*100) / 100
		stats.HelicopterTime = math.Round(stats.HelicopterTime*100) / 100
		stats.GyroplaneTime = math.Round(stats.GyroplaneTime*100) / 100
		stats.PoweredLiftTime = math.Round(stats.PoweredLiftTime*100) / 100
		stats.GliderTime = math.Round(stats.GliderTime*100) / 100
		stats.BalloonTime = math.Round(stats.BalloonTime*100) / 100
		stats.AirshipTime = math.Round(stats.AirshipTime*100) / 100
		stats.SoloTime = math.Round(stats.SoloTime*100) / 100
		stats.PICTime = math.Round(stats.PICTime*100) / 100
		stats.SICTime = math.Round(stats.SICTime*100) / 100
		stats.DualTime = math.Round(stats.DualTime*100) / 100
		stats.InstructorTime = math.Round(stats.InstructorTime*100) / 100
		stats.XCountryTime = math.Round(stats.XCountryTime*100) / 100
		stats.ActInstrumentTime = math.Round(stats.ActInstrumentTime*100) / 100
		stats.SimInstrumentTime = math.Round(stats.SimInstrumentTime*100) / 100
		stats.FullFlightSimulatorTime = math.Round(stats.FullFlightSimulatorTime*100) / 100
		stats.FlightTrainingDeviceTime = math.Round(stats.FlightTrainingDeviceTime*100) / 100
		stats.AviationTrainingDeviceTime = math.Round(stats.AviationTrainingDeviceTime*100) / 100

		writeJSON(w, 200, stats)
	}
}

// ── GET /api/dashboard/aircraft-type-stats ──

func getAircraftTypeStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		// ── Get all distinct aircraft types ordered by total hours desc ──
		rows, err := db.QueryContext(r.Context(), `
			SELECT
				aircraft_type,
				COALESCE(SUM(total_time), 0),
				COUNT(*),
				COALESCE(SUM(sel_time), 0),
				COALESCE(SUM(ses_time), 0),
				COALESCE(SUM(mel_time), 0),
				COALESCE(SUM(mes_time), 0),
				COALESCE(SUM(helicopter_time), 0),
				COALESCE(SUM(gyroplane_time), 0),
				COALESCE(SUM(powered_lift_time), 0),
				COALESCE(SUM(glider_time), 0),
				COALESCE(SUM(balloon_time), 0),
				COALESCE(SUM(airship_time), 0),
				COALESCE(SUM(solo_time), 0),
				COALESCE(SUM(pic_time), 0),
				COALESCE(SUM(sic_time), 0),
				COALESCE(SUM(dual_time), 0),
				COALESCE(SUM(instructor_time), 0),
				COALESCE(SUM(xcountry_time), 0),
				COALESCE(SUM(night_time), 0),
				COALESCE(SUM(act_instrument_time), 0),
				COALESCE(SUM(sim_instrument_time), 0),
				COALESCE(SUM(full_flight_simulator_time), 0),
				COALESCE(SUM(flight_training_device_time), 0),
				COALESCE(SUM(aviation_training_device_time), 0),
				COALESCE(SUM(takeoffs_day), 0),
				COALESCE(SUM(takeoffs_night), 0),
				COALESCE(SUM(landings_day), 0),
				COALESCE(SUM(landings_night), 0),
				COALESCE(SUM(precision_approaches), 0),
				COALESCE(SUM(non_precision_approaches), 0),
				COALESCE(SUM(holding_patterns), 0),
				MAX(date) AS last_flight_date
			FROM flights
			WHERE user_id = ?
			GROUP BY aircraft_type
			ORDER BY SUM(total_time) DESC`, userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		var stats []AircraftTypeStat
		now := time.Now()

		for rows.Next() {
			var s AircraftTypeStat
			var lastFlightDate string
			err := rows.Scan(
				&s.AircraftType,
				&s.TotalHours,
				&s.FlightCount,
				&s.SELTime,
				&s.SESTime,
				&s.MELTime,
				&s.MESTime,
				&s.HelicopterTime,
				&s.GyroplaneTime,
				&s.PoweredLiftTime,
				&s.GliderTime,
				&s.BalloonTime,
				&s.AirshipTime,
				&s.SoloTime,
				&s.PICTime,
				&s.SICTime,
				&s.DualTime,
				&s.InstructorTime,
				&s.XCountryTime,
				&s.NightTime,
				&s.ActInstrumentTime,
				&s.SimInstrumentTime,
				&s.FullFlightSimulatorTime,
				&s.FlightTrainingDeviceTime,
				&s.AviationTrainingDeviceTime,
				&s.TakeoffsDay,
				&s.TakeoffsNight,
				&s.LandingsDay,
				&s.LandingsNight,
				&s.PrecisionApproaches,
				&s.NonPrecisionApproaches,
				&s.HoldingPatterns,
				&lastFlightDate,
			)
			if err != nil {
				writeError(w, 500, "Database error")
				return
			}

			// Round all float fields to 2 decimal places
			s.TotalHours = math.Round(s.TotalHours*100) / 100
			s.SELTime = math.Round(s.SELTime*100) / 100
			s.SESTime = math.Round(s.SESTime*100) / 100
			s.MELTime = math.Round(s.MELTime*100) / 100
			s.MESTime = math.Round(s.MESTime*100) / 100
			s.HelicopterTime = math.Round(s.HelicopterTime*100) / 100
			s.GyroplaneTime = math.Round(s.GyroplaneTime*100) / 100
			s.PoweredLiftTime = math.Round(s.PoweredLiftTime*100) / 100
			s.GliderTime = math.Round(s.GliderTime*100) / 100
			s.BalloonTime = math.Round(s.BalloonTime*100) / 100
			s.AirshipTime = math.Round(s.AirshipTime*100) / 100
			s.SoloTime = math.Round(s.SoloTime*100) / 100
			s.PICTime = math.Round(s.PICTime*100) / 100
			s.SICTime = math.Round(s.SICTime*100) / 100
			s.DualTime = math.Round(s.DualTime*100) / 100
			s.InstructorTime = math.Round(s.InstructorTime*100) / 100
			s.XCountryTime = math.Round(s.XCountryTime*100) / 100
			s.NightTime = math.Round(s.NightTime*100) / 100
			s.ActInstrumentTime = math.Round(s.ActInstrumentTime*100) / 100
			s.SimInstrumentTime = math.Round(s.SimInstrumentTime*100) / 100
			s.FullFlightSimulatorTime = math.Round(s.FullFlightSimulatorTime*100) / 100
			s.FlightTrainingDeviceTime = math.Round(s.FlightTrainingDeviceTime*100) / 100
			s.AviationTrainingDeviceTime = math.Round(s.AviationTrainingDeviceTime*100) / 100

			// Calculate days since last flight
			if lastFlightDate != "" {
				parsed, parseErr := time.Parse("2006-01-02", lastFlightDate)
				if parseErr == nil {
					s.DaysSinceLastFlight = math.Round(now.Sub(parsed).Hours()/24*100) / 100
				}
			}

			stats = append(stats, s)
		}
		rows.Close()

		if stats == nil {
			stats = []AircraftTypeStat{}
		}

		writeJSON(w, 200, stats)
	}
}
