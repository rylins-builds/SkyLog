package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// getDBPath returns the path to the SQLite database file.
// Defaults to the Docker volume mount location; falls back to CWD for local dev.
func getDBPath() string {
	// Default to Docker volume path
	return "/app/data/skylog.db"
}

// openDB opens the SQLite database with WAL mode and returns a *sql.DB handle.
func openDB() (*sql.DB, error) {
	dbPath := getDBPath()

	// Ensure the parent directory exists (important for Docker volume mounts).
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// Enable WAL mode and foreign keys.
	pragmas := []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA foreign_keys=ON;",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q: %w", p, err)
		}
	}

	return db, nil
}

// initDB creates tables and seeds initial data. Idempotent — safe to call on every startup.
func initDB(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// ── Core tables ──

	schema := `
		CREATE TABLE IF NOT EXISTS flights (
			id                    INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id               INTEGER NOT NULL DEFAULT 0,
			date                  TEXT    NOT NULL,
			pilot_in_command      TEXT    NOT NULL,
			aircraft_type         TEXT    NOT NULL,
			aircraft_reg          TEXT    NOT NULL,
			departure             TEXT    NOT NULL,
			arrival               TEXT    NOT NULL,
			departure_time        TEXT,
			arrival_time          TEXT,
			total_time            REAL    NOT NULL CHECK(total_time > 0),
			sel_time              REAL    NOT NULL CHECK(sel_time >= 0),
			ses_time              REAL    NOT NULL CHECK(ses_time >= 0),
			mel_time              REAL    NOT NULL CHECK(mel_time >= 0),
			mes_time              REAL    NOT NULL CHECK(mes_time >= 0),
			helicopter_time       REAL    NOT NULL CHECK(helicopter_time >= 0),
			gyroplane_time        REAL    NOT NULL DEFAULT 0 CHECK(gyroplane_time >= 0),
			powered_lift_time     REAL    NOT NULL DEFAULT 0 CHECK(powered_lift_time >= 0),
			glider_time           REAL    NOT NULL CHECK(glider_time >= 0),
			balloon_time          REAL    NOT NULL DEFAULT 0 CHECK(balloon_time >= 0),
			airship_time          REAL    NOT NULL DEFAULT 0 CHECK(airship_time >= 0),
			solo_time             REAL    NOT NULL CHECK(solo_time >= 0),
			pic_time              REAL    NOT NULL CHECK(pic_time >= 0),
			sic_time              REAL    NOT NULL CHECK(sic_time >= 0),
			dual_time             REAL    NOT NULL CHECK(dual_time >= 0),
			instructor_time       REAL    NOT NULL CHECK(instructor_time >= 0),
			xcountry_time         REAL    NOT NULL CHECK(xcountry_time >= 0),
			night_time            REAL    DEFAULT 0 CHECK(night_time >= 0),
			act_instrument_time   REAL    NOT NULL CHECK(act_instrument_time >= 0),
			sim_instrument_time   REAL    NOT NULL CHECK(sim_instrument_time >= 0),
			full_flight_simulator_time       REAL    NOT NULL DEFAULT 0 CHECK(full_flight_simulator_time >= 0),
			flight_training_device_time      REAL    NOT NULL DEFAULT 0 CHECK(flight_training_device_time >= 0),
			aviation_training_device_time    REAL    NOT NULL DEFAULT 0 CHECK(aviation_training_device_time >= 0),
			takeoffs_day          INTEGER DEFAULT 0 CHECK(takeoffs_day >= 0),
			takeoffs_night        INTEGER DEFAULT 0 CHECK(takeoffs_night >= 0),
			landings_day          INTEGER DEFAULT 0 CHECK(landings_day >= 0),
			landings_night        INTEGER DEFAULT 0 CHECK(landings_night >= 0),
			precision_approaches      INTEGER DEFAULT 0 CHECK(precision_approaches >= 0),
			non_precision_approaches  INTEGER DEFAULT 0 CHECK(non_precision_approaches >= 0),
			holding_patterns          INTEGER DEFAULT 0 CHECK(holding_patterns >= 0),
			launch_type           TEXT,
			remarks               TEXT,
			created_at            TEXT    DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS users (
			id       INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT    NOT NULL UNIQUE,
			password TEXT    NOT NULL
		);

		CREATE TABLE IF NOT EXISTS sessions (
			token    TEXT PRIMARY KEY,
			user_id  INTEGER NOT NULL,
			created  TEXT DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS currency_thresholds (
			user_id     INTEGER NOT NULL,
			category_id TEXT    NOT NULL,
			min_count   INTEGER NOT NULL DEFAULT 6,
			days_window INTEGER NOT NULL DEFAULT 180,
			PRIMARY KEY (user_id, category_id)
		);

		CREATE TABLE IF NOT EXISTS user_visibility (
			user_id            INTEGER PRIMARY KEY,
			page_visibility    TEXT NOT NULL DEFAULT '{}',
			column_visibility  TEXT NOT NULL DEFAULT '{}'
		);

		CREATE TABLE IF NOT EXISTS user_dashboard (
			user_id           INTEGER PRIMARY KEY,
			layout            TEXT NOT NULL DEFAULT '[]'
		);

		CREATE TABLE IF NOT EXISTS attachments (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			flight_id    INTEGER NOT NULL,
			user_id      INTEGER NOT NULL,
			filename     TEXT    NOT NULL,
			content_type TEXT    NOT NULL DEFAULT 'application/octet-stream',
			size         INTEGER NOT NULL DEFAULT 0,
			created_at   TEXT    DEFAULT (datetime('now')),
			FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_attachments_flight ON attachments(flight_id);
	`

	if _, err := tx.ExecContext(ctx, schema); err != nil {
		return fmt.Errorf("create tables: %w", err)
	}

	// ── Migration: add user_id to flights if missing ──
	rows, err := tx.QueryContext(ctx, "PRAGMA table_info(flights)")
	if err != nil {
		return fmt.Errorf("pragma table_info: %w", err)
	}
	hasUserID := false
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
			rows.Close()
			return fmt.Errorf("scan table_info: %w", err)
		}
		if name == "user_id" {
			hasUserID = true
		}
	}
	rows.Close()
	if !hasUserID {
		if _, err := tx.ExecContext(ctx, "ALTER TABLE flights ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0"); err != nil {
			return fmt.Errorf("add user_id column: %w", err)
		}
	}

	// ── Migration: add launch_type to flights if missing ──
	rows2, err := tx.QueryContext(ctx, "PRAGMA table_info(flights)")
	if err != nil {
		return fmt.Errorf("pragma table_info flights: %w", err)
	}
	hasLaunchType := false
	for rows2.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dflt sql.NullString
		if err := rows2.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
			rows2.Close()
			return fmt.Errorf("scan table_info: %w", err)
		}
		if name == "launch_type" {
			hasLaunchType = true
		}
	}
	rows2.Close()
	if !hasLaunchType {
		if _, err := tx.ExecContext(ctx, "ALTER TABLE flights ADD COLUMN launch_type TEXT"); err != nil {
			return fmt.Errorf("add launch_type column: %w", err)
		}
	}

	// ── Auto-create admin user on first run ──
	var userCount int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&userCount); err != nil {
		return fmt.Errorf("check user count: %w", err)
	}
	if userCount == 0 {
		if _, err := tx.ExecContext(ctx, "INSERT INTO users (id, username, password) VALUES (1, 'admin', '')"); err != nil {
			return fmt.Errorf("insert admin: %w", err)
		}
		if _, err := tx.ExecContext(ctx, "INSERT OR REPLACE INTO settings (key, value) VALUES ('multi_user_mode', 'false')"); err != nil {
			return fmt.Errorf("insert setting multi_user_mode: %w", err)
		}
		if _, err := tx.ExecContext(ctx, "INSERT OR REPLACE INTO settings (key, value) VALUES ('username', 'admin')"); err != nil {
			return fmt.Errorf("insert setting username: %w", err)
		}
	}

	return tx.Commit()
}

// scanFlight scans a single sql.Row/Row into a Flight struct.
func scanFlight(scanner interface {
	Scan(dest ...any) error
}) (Flight, error) {
	var f Flight
	err := scanner.Scan(
		&f.ID, &f.UserID, &f.Date,
		&f.PilotInCommand,
		&f.AircraftType, &f.AircraftReg,
		&f.Departure, &f.Arrival,
		&f.DepartureTime, &f.ArrivalTime,
		&f.TotalTime, &f.SELTime, &f.SESTime, &f.MELTime, &f.MESTime,
		&f.HelicopterTime, &f.GyroplaneTime, &f.PoweredLiftTime,
		&f.GliderTime, &f.BalloonTime, &f.AirshipTime,
		&f.SoloTime, &f.PICTime, &f.SICTime, &f.DualTime, &f.InstructorTime,
		&f.XCountryTime, &f.NightTime,
		&f.ActInstrumentTime, &f.SimInstrumentTime,
		&f.FullFlightSimulatorTime, &f.FlightTrainingDeviceTime, &f.AviationTrainingDeviceTime,
		&f.TakeoffsDay, &f.TakeoffsNight, &f.LandingsDay, &f.LandingsNight,
		&f.PrecisionApproaches, &f.NonPrecisionApproaches,
		&f.HoldingPatterns,
		&f.LaunchType, &f.Remarks,
		&f.CreatedAt,
	)
	return f, err
}

// scanFlights scans all rows from a *sql.Rows into a []Flight.
func scanFlights(rows *sql.Rows) ([]Flight, error) {
	defer rows.Close()
	var flights []Flight
	for rows.Next() {
		f, err := scanFlight(rows)
		if err != nil {
			return nil, fmt.Errorf("scan flight: %w", err)
		}
		flights = append(flights, f)
	}
	return flights, rows.Err()
}

var _ = scanFlights // suppress unused warning — used in flights.go
