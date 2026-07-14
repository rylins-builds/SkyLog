package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

// registerFAA8710Routes adds FAA 8710 mapping routes to the given mux.
func registerFAA8710Routes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/faa8710/mappings", getFAA8710Mappings(db))
	mux.HandleFunc("PUT /api/faa8710/mappings", saveFAA8710Mappings(db))
}

// faa8710MappingsSaveRequest is the body for PUT /api/faa8710/mappings.
type faa8710MappingsSaveRequest struct {
	Mappings map[string]string `json:"mappings"`
}

// validFAA8710Categories is the set of allowable 8710 category keys.
var validFAA8710Categories = map[string]bool{
	"sel": true, "ses": true, "mel": true, "mes": true,
	"helicopter": true, "gyroplane": true,
	"powered_lift": true, "glider": true,
	"balloon": true, "airship": true,
	"full_flight_simulator": true, "flight_training_device": true,
	"aviation_training_device": true,
}

// ── GET /api/faa8710/mappings ──

func getFAA8710Mappings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		key := fmt.Sprintf("faa8710_mappings_%d", userID)
		var raw string
		err = db.QueryRowContext(r.Context(),
			"SELECT value FROM settings WHERE key = ?", key,
		).Scan(&raw)

		if err == sql.ErrNoRows {
			writeJSON(w, 200, map[string]string{})
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		var mappings map[string]string
		if err := json.Unmarshal([]byte(raw), &mappings); err != nil {
			writeJSON(w, 200, map[string]string{})
			return
		}

		writeJSON(w, 200, mappings)
	}
}

// ── PUT /api/faa8710/mappings ──

func saveFAA8710Mappings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req faa8710MappingsSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		// Validate category values
		for aType, cat := range req.Mappings {
			if aType == "" {
				writeError(w, 422, "Aircraft type cannot be empty")
				return
			}
			if !validFAA8710Categories[cat] {
				writeError(w, 422, fmt.Sprintf("Invalid category: %s", cat))
				return
			}
		}

		raw, err := json.Marshal(req.Mappings)
		if err != nil {
			writeError(w, 500, "Failed to encode mappings")
			return
		}

		key := fmt.Sprintf("faa8710_mappings_%d", userID)
		_, err = db.ExecContext(r.Context(),
			"INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
			key, string(raw),
		)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}
