package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
)

// registerSettingsRoutes adds all settings, auth, and currency routes to the given mux.
func registerSettingsRoutes(mux *http.ServeMux, db *sql.DB) {
	// Auth
	mux.HandleFunc("POST /api/auth/login", login(db))
	mux.HandleFunc("POST /api/auth/create-user", createUser(db))
	mux.HandleFunc("GET /api/auth/is-admin", isAdmin(db))
	mux.HandleFunc("GET /api/auth/has-user", hasUser)
	mux.HandleFunc("GET /api/auth/multi-user-mode", getMultiUserMode(db))
	mux.HandleFunc("PUT /api/auth/multi-user-mode", setMultiUserMode(db))
	mux.HandleFunc("GET /api/auth/show-welcome", getShowWelcome(db))
	mux.HandleFunc("GET /api/auth/auto-login", autoLogin(db))
	// Settings
	mux.HandleFunc("GET /api/settings/user", getCurrentUser(db))
	mux.HandleFunc("PUT /api/settings/username", updateUsername(db))
	mux.HandleFunc("PUT /api/settings/password", changePassword(db))
	mux.HandleFunc("GET /api/settings/visibility", getVisibility(db))
	mux.HandleFunc("PUT /api/settings/visibility", saveVisibility(db))
	mux.HandleFunc("GET /api/settings/has-glider-launch-type", hasGliderLaunchType(db))
	mux.HandleFunc("DELETE /api/settings/reset", resetSettings(db))
	// Currency
	mux.HandleFunc("GET /api/currency/thresholds", getCurrencyThresholds(db))
	mux.HandleFunc("PUT /api/currency/thresholds", saveCurrencyThresholds(db))
	// Dashboard
	mux.HandleFunc("GET /api/settings/dashboard-layout", getDashboardLayout(db))
	mux.HandleFunc("PUT /api/settings/dashboard-layout", saveDashboardLayout(db))
	// Default page
	mux.HandleFunc("GET /api/settings/default-page", getDefaultPage(db))
	mux.HandleFunc("PUT /api/settings/default-page", saveDefaultPage(db))
}

// ── Password hashing ──

func hashPassword(password string) (string, error) {
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	pwd := append(salt, []byte(password)...)
	hash := sha256.Sum256(pwd)
	return hex.EncodeToString(salt) + ":" + hex.EncodeToString(hash[:]), nil
}

func verifyPassword(password, stored string) bool {
	var saltHex, hashHex string
	found := false
	for i, c := range stored {
		if c == ':' {
			saltHex = stored[:i]
			hashHex = stored[i+1:]
			found = true
			break
		}
	}
	if !found {
		return false
	}
	salt, err := hex.DecodeString(saltHex)
	if err != nil || len(salt) == 0 {
		return false
	}
	pwd := append(salt, []byte(password)...)
	hash := sha256.Sum256(pwd)
	return hex.EncodeToString(hash[:]) == hashHex
}

func createSession(db *sql.DB, userID int) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)
	_, err := db.Exec("INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)", token, userID)
	return token, err
}

// ── POST /api/auth/login ──

func login(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}
		if req.Username == "" || req.Password == "" {
			writeError(w, 400, "Username and password are required")
			return
		}

		var userID int
		var username, passwordHash string
		err := db.QueryRowContext(r.Context(),
			"SELECT id, username, password FROM users WHERE username = ?", req.Username).Scan(&userID, &username, &passwordHash)
		if err == sql.ErrNoRows {
			writeError(w, 403, "Invalid username or password")
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		if !verifyPassword(req.Password, passwordHash) {
			writeError(w, 403, "Invalid username or password")
			return
		}

		token, err := createSession(db, userID)
		if err != nil {
			writeError(w, 500, "Failed to create session")
			return
		}

		writeJSON(w, 200, TokenResponse{Token: token, Username: username})
	}
}

// ── POST /api/auth/create-user ──

func createUser(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}
		if req.Username == "" {
			writeError(w, 400, "Username cannot be empty")
			return
		}
		if len(req.Password) < 6 {
			writeError(w, 400, "Password must be at least 6 characters")
			return
		}

		var existing int
		_ = db.QueryRowContext(r.Context(),
			"SELECT id FROM users WHERE username = ?", req.Username).Scan(&existing)
		if existing != 0 {
			writeError(w, 409, "Username already taken")
			return
		}

		hashed, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, 500, "Failed to hash password")
			return
		}

		result, err := db.ExecContext(r.Context(),
			"INSERT INTO users (username, password) VALUES (?, ?)", req.Username, hashed)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		userID, _ := result.LastInsertId()
		token, err := createSession(db, int(userID))
		if err != nil {
			writeError(w, 500, "Failed to create session")
			return
		}

		writeJSON(w, 200, TokenResponse{Token: token, Username: req.Username})
	}
}

// ── GET /api/auth/is-admin ──

func isAdmin(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			writeJSON(w, 200, map[string]bool{"isAdmin": false})
			return
		}
		writeJSON(w, 200, map[string]bool{"isAdmin": userID == 1})
	}
}

// ── GET /api/auth/has-user ──

func hasUser(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]bool{"hasUser": true})
}

// ── GET /api/auth/multi-user-mode ──

func getMultiUserMode(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var val string
		err := db.QueryRowContext(r.Context(),
			"SELECT value FROM settings WHERE key = 'multi_user_mode'").Scan(&val)
		enabled := err == nil && val == "true"
		writeJSON(w, 200, map[string]bool{"multiUserMode": enabled})
	}
}

// ── GET /api/auth/show-welcome ──

func getShowWelcome(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var val string
		err := db.QueryRowContext(r.Context(),
			"SELECT value FROM settings WHERE key = 'multi_user_mode'").Scan(&val)
		show := err == nil && val == "true"
		writeJSON(w, 200, map[string]bool{"showLoginPage": show})
	}
}

// ── PUT /api/auth/multi-user-mode ──

func setMultiUserMode(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}
		if userID != 1 {
			writeError(w, 403, "Only admin can change multi-user mode")
			return
		}

		var req MultiUserModeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}
		if req.Password == nil || *req.Password == "" {
			writeError(w, 400, "Password is required")
			return
		}

		if req.Enabled {
			if len(*req.Password) < 6 {
				writeError(w, 400, "Password must be at least 6 characters")
				return
			}

			var storedPw string
			err := db.QueryRowContext(r.Context(),
				"SELECT password FROM users WHERE id = 1").Scan(&storedPw)
			if err != nil && err != sql.ErrNoRows {
				writeError(w, 500, "Database error")
				return
			}
			if storedPw != "" {
				if !verifyPassword(*req.Password, storedPw) {
					writeError(w, 403, "Incorrect password")
					return
				}
			} else {
				hashed, err := hashPassword(*req.Password)
				if err != nil {
					writeError(w, 500, "Failed to hash password")
					return
				}
				db.ExecContext(r.Context(), "UPDATE users SET password = ? WHERE id = 1", hashed)
				db.ExecContext(r.Context(),
					"INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)", hashed)
			}
			db.ExecContext(r.Context(),
				"INSERT OR REPLACE INTO settings (key, value) VALUES ('multi_user_mode', 'true')")
			writeJSON(w, 200, map[string]bool{"multiUserMode": true})
		} else {
			var storedPw string
			err := db.QueryRowContext(r.Context(),
				"SELECT password FROM users WHERE id = 1").Scan(&storedPw)
			if err != nil && err != sql.ErrNoRows {
				writeError(w, 500, "Database error")
				return
			}
			if storedPw != "" {
				if !verifyPassword(*req.Password, storedPw) {
					writeError(w, 403, "Incorrect password")
					return
				}
			}
			db.ExecContext(r.Context(),
				"INSERT OR REPLACE INTO settings (key, value) VALUES ('multi_user_mode', 'false')")
			writeJSON(w, 200, map[string]bool{"multiUserMode": false})
		}
	}
}

// ── GET /api/auth/auto-login ──

func autoLogin(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var val string
		err := db.QueryRowContext(r.Context(),
			"SELECT value FROM settings WHERE key = 'multi_user_mode'").Scan(&val)
		if err == nil && val == "true" {
			writeError(w, 403, "Multi-user mode is enabled, use login instead")
			return
		}

		var userID int
		var username string
		err = db.QueryRowContext(r.Context(),
			"SELECT id, username FROM users WHERE id = 1").Scan(&userID, &username)
		if err != nil {
			writeError(w, 500, "Admin user not found")
			return
		}

		token, err := createSession(db, userID)
		if err != nil {
			writeError(w, 500, "Failed to create session")
			return
		}

		writeJSON(w, 200, TokenResponse{Token: token, Username: username})
	}
}

// ── GET /api/settings/user ──

func getCurrentUser(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var username string
		err = db.QueryRowContext(r.Context(),
			"SELECT username FROM users WHERE id = ?", userID).Scan(&username)
		if err != nil {
			username = "pilot"
		}
		writeJSON(w, 200, map[string]string{"username": username})
	}
}

// ── PUT /api/settings/username ──

func updateUsername(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req UsernameUpdate
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}
		if req.Username == "" {
			writeError(w, 400, "Username cannot be empty")
			return
		}
		if len(req.Username) > 100 {
			writeError(w, 400, "Username too long")
			return
		}

		_, err = db.ExecContext(r.Context(),
			"UPDATE users SET username = ? WHERE id = ?", req.Username, userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		db.ExecContext(r.Context(),
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('username', ?)", req.Username)

		writeJSON(w, 200, map[string]string{"username": req.Username})
	}
}

// ── PUT /api/settings/password ──

func changePassword(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req PasswordUpdate
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}
		if len(req.NewPassword) < 6 {
			writeError(w, 400, "Password must be at least 6 characters")
			return
		}

		var storedPw string
		err = db.QueryRowContext(r.Context(),
			"SELECT password FROM users WHERE id = ?", userID).Scan(&storedPw)
		if err == sql.ErrNoRows {
			writeError(w, 404, "User not found")
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}
		if !verifyPassword(req.CurrentPassword, storedPw) {
			writeError(w, 403, "Current password is incorrect")
			return
		}

		hashed, err := hashPassword(req.NewPassword)
		if err != nil {
			writeError(w, 500, "Failed to hash password")
			return
		}

		_, err = db.ExecContext(r.Context(), "UPDATE users SET password = ? WHERE id = ?", hashed, userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		db.ExecContext(r.Context(),
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', ?)", hashed)

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// ── GET /api/settings/dashboard-layout ──

func getDashboardLayout(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var layoutJSON string
		err = db.QueryRowContext(r.Context(),
			"SELECT layout FROM user_dashboard WHERE user_id = ?", userID,
		).Scan(&layoutJSON)
		if err != nil {
			// No saved layout — return default tile set
			defaultLayout := getDefaultDashboardLayout()
			writeJSON(w, 200, DashboardLayoutResponse{Layout: defaultLayout})
			return
		}

		var layout []DashboardLayoutTile
		if err := json.Unmarshal([]byte(layoutJSON), &layout); err != nil {
			// Corrupted layout — return defaults
			defaultLayout := getDefaultDashboardLayout()
			writeJSON(w, 200, DashboardLayoutResponse{Layout: defaultLayout})
			return
		}

		writeJSON(w, 200, DashboardLayoutResponse{Layout: layout})
	}
}

// ── PUT /api/settings/dashboard-layout ──

func saveDashboardLayout(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req DashboardLayoutSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		b, err := json.Marshal(req.Layout)
		if err != nil {
			writeError(w, 500, "Failed to serialise layout")
			return
		}

		_, err = db.ExecContext(r.Context(),
			`INSERT OR REPLACE INTO user_dashboard (user_id, layout) VALUES (?, ?)`,
			userID, string(b))
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// getDefaultDashboardLayout returns the default set of tiles for new users.
// Matches the frontend's TILE_REGISTRY enabledByDefault tiles.
func getDefaultDashboardLayout() []DashboardLayoutTile {
	return []DashboardLayoutTile{
		{Type: "total-flights", Width: 1, Order: 0},
		{Type: "total-hours", Width: 1, Order: 1},
		{Type: "night-hours", Width: 1, Order: 2},
		{Type: "hours-last-30-days", Width: 1, Order: 3},
		{Type: "total-landings", Width: 1, Order: 4},
		{Type: "unique-aircraft", Width: 1, Order: 5},
	}
}

// ── GET /api/settings/has-glider-launch-type ──

func hasGliderLaunchType(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var count int
		err = db.QueryRowContext(r.Context(), `
			SELECT COUNT(*) FROM flights
			WHERE user_id = ?
			  AND launch_type IS NOT NULL
			  AND launch_type != ''
			  AND (glider_time > 0 OR balloon_time > 0 OR airship_time > 0)
		`, userID).Scan(&count)

		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, map[string]bool{"hasGliderLaunchType": count > 0})
	}
}

// ── GET /api/currency/thresholds ──

func getCurrencyThresholds(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			"SELECT category_id, min_count, days_window FROM currency_thresholds WHERE user_id = ?", userID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}
		defer rows.Close()

		thresholds := make(map[string]CurrencyThresholdResponse)
		for rows.Next() {
			var catID string
			var resp CurrencyThresholdResponse
			if err := rows.Scan(&catID, &resp.MinCount, &resp.DaysWindow); err != nil {
				writeError(w, 500, "Database error")
				return
			}
			thresholds[catID] = resp
		}

		writeJSON(w, 200, map[string]any{"thresholds": thresholds})
	}
}

// ── PUT /api/currency/thresholds ──

func saveCurrencyThresholds(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req CurrencyThresholdsSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		for _, entry := range req.Thresholds {
			_, err := db.ExecContext(r.Context(),
				`INSERT OR REPLACE INTO currency_thresholds (user_id, category_id, min_count, days_window)
				 VALUES (?, ?, ?, ?)`,
				userID, entry.CategoryID, entry.MinCount, entry.DaysWindow)
			if err != nil {
				writeError(w, 500, "Database error")
				return
			}
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// ── GET /api/settings/visibility ──

func getVisibility(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var pageVis, colVis string
		err = db.QueryRowContext(r.Context(),
			"SELECT page_visibility, column_visibility FROM user_visibility WHERE user_id = ?", userID,
		).Scan(&pageVis, &colVis)
		if err != nil {
			writeJSON(w, 200, map[string]string{"pageVisibility": "{}", "columnVisibility": "{}"})
			return
		}

		writeJSON(w, 200, map[string]string{
			"pageVisibility":   pageVis,
			"columnVisibility": colVis,
		})
	}
}

// ── DELETE /api/settings/reset ──

func resetSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		// Delete visibility preferences
		_, _ = db.ExecContext(r.Context(),
			"DELETE FROM user_visibility WHERE user_id = ?", userID)
		// Delete currency thresholds
		_, _ = db.ExecContext(r.Context(),
			"DELETE FROM currency_thresholds WHERE user_id = ?", userID)
		// Delete dashboard layout
		_, _ = db.ExecContext(r.Context(),
			"DELETE FROM user_dashboard WHERE user_id = ?", userID)

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// ── PUT /api/settings/visibility ──

func saveVisibility(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req VisibilitySaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		_, err = db.ExecContext(r.Context(),
			`INSERT OR REPLACE INTO user_visibility (user_id, page_visibility, column_visibility)
			 VALUES (?, ?, ?)`,
			userID, req.PageVisibility, req.ColumnVisibility)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}

// ── GET /api/settings/default-page ──

func getDefaultPage(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		key := fmt.Sprintf("default_page_%d", userID)
		var val string
		err = db.QueryRowContext(r.Context(),
			"SELECT value FROM settings WHERE key = ?", key).Scan(&val)
		if err != nil || val == "" {
			writeJSON(w, 200, DefaultPageResponse{Page: "dashboard"})
			return
		}

		writeJSON(w, 200, DefaultPageResponse{Page: val})
	}
}

// ── PUT /api/settings/default-page ──

func saveDefaultPage(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		var req DefaultPageSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, 422, "Invalid JSON body")
			return
		}

		validPages := map[string]bool{
			"dashboard": true, "logbook": true, "currency": true,
			"FAA8710": true, "settings": true, "add": true,
		}
		if !validPages[req.Page] {
			writeError(w, 422, "Invalid page. Must be one of: dashboard, logbook, currency, FAA8710, settings, add")
			return
		}

		key := fmt.Sprintf("default_page_%d", userID)
		_, err = db.ExecContext(r.Context(),
			"INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, req.Page)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		writeJSON(w, 200, map[string]string{"status": "ok"})
	}
}
