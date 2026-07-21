package main

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// maxAttachmentSize is the maximum allowed size for a single uploaded file (25 MB).
const maxAttachmentSize = 25 << 20

// maxAttachmentUploadMem is the memory budget for parsing multipart forms (32 MB).
const maxAttachmentUploadMem = 32 << 20

// attachmentsBaseDir returns the root directory where attachment files are stored.
// Files are organised as <base>/<user_id>/<flight_id>/<id>_<sanitised_filename>.
func attachmentsBaseDir() string {
	return filepath.Join(filepath.Dir(getDBPath()), "attachments")
}

// registerAttachmentRoutes adds all attachment-related routes to the given mux.
func registerAttachmentRoutes(mux *http.ServeMux, db *sql.DB) {
	mux.HandleFunc("GET /api/flights/{id}/attachments", listAttachments(db))
	mux.HandleFunc("POST /api/flights/{id}/attachments", uploadAttachment(db))
	mux.HandleFunc("GET /api/attachments/{id}/download", downloadAttachment(db))
	mux.HandleFunc("DELETE /api/attachments/{id}", deleteAttachment(db))
}

// flightOwnedBy checks that the given flight belongs to the given user.
func flightOwnedBy(r *http.Request, db *sql.DB, flightID, userID int) error {
	var exists int
	err := db.QueryRowContext(r.Context(),
		"SELECT COUNT(*) FROM flights WHERE id = ? AND user_id = ?", flightID, userID).Scan(&exists)
	if err != nil {
		return &httpError{500, "Database error"}
	}
	if exists == 0 {
		return &httpError{404, "Flight not found"}
	}
	return nil
}

// ── GET /api/flights/{id}/attachments ──

func listAttachments(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		flightID, _ := strconv.Atoi(r.PathValue("id"))
		if err := flightOwnedBy(r, db, flightID, userID); err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		rows, err := db.QueryContext(r.Context(),
			"SELECT id, flight_id, filename, content_type, size, created_at FROM attachments WHERE flight_id = ? ORDER BY id",
			flightID)
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}
		defer rows.Close()

		attachments := []Attachment{}
		for rows.Next() {
			var a Attachment
			if err := rows.Scan(&a.ID, &a.FlightID, &a.Filename, &a.ContentType, &a.Size, &a.CreatedAt); err != nil {
				writeError(w, 500, "Database error")
				return
			}
			attachments = append(attachments, a)
		}

		writeJSON(w, 200, attachments)
	}
}

// saveAttachmentFile persists one uploaded file for a flight: inserts the DB
// row, writes the file to disk under <base>/<user>/<flight>/, and returns the
// resulting Attachment. It is shared by the standalone upload endpoint and by
// flight create/update when attachments are bundled into the same request.
func saveAttachmentFile(r *http.Request, db *sql.DB, flightID, userID int, header *multipart.FileHeader) (*Attachment, error) {
	file, err := header.Open()
	if err != nil {
		return nil, fmt.Errorf("open multipart file: %w", err)
	}
	defer file.Close()

	filename := sanitizeFilename(header.Filename)
	if filename == "" {
		return nil, &httpError{422, "Invalid filename"}
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Insert the DB row first so we have an ID for the file path.
	result, err := db.ExecContext(r.Context(),
		"INSERT INTO attachments (flight_id, user_id, filename, content_type, size) VALUES (?, ?, ?, ?, ?)",
		flightID, userID, filename, contentType, header.Size)
	if err != nil {
		log.Printf("saveAttachmentFile insert: %v", err)
		return nil, &httpError{500, "Database error"}
	}
	attachmentID, _ := result.LastInsertId()

	// Write the file to disk: <base>/<user>/<flight>/<id>_<filename>
	dir := filepath.Join(attachmentsBaseDir(), strconv.Itoa(userID), strconv.Itoa(flightID))
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("saveAttachmentFile mkdir: %v", err)
		return nil, &httpError{500, "Failed to store file"}
	}
	storedName := fmt.Sprintf("%d_%s", attachmentID, filename)
	destPath := filepath.Join(dir, storedName)

	dest, err := os.Create(destPath)
	if err != nil {
		log.Printf("saveAttachmentFile create: %v", err)
		return nil, &httpError{500, "Failed to store file"}
	}
	written, err := io.Copy(dest, file)
	dest.Close()
	if err != nil {
		os.Remove(destPath)
		log.Printf("saveAttachmentFile copy: %v", err)
		return nil, &httpError{500, "Failed to store file"}
	}

	// Persist the real written size (defensive against mismatched header size).
	if written != header.Size {
		db.ExecContext(r.Context(),
			"UPDATE attachments SET size = ? WHERE id = ?", written, attachmentID)
	}

	var a Attachment
	err = db.QueryRowContext(r.Context(),
		"SELECT id, flight_id, filename, content_type, size, created_at FROM attachments WHERE id = ?",
		attachmentID).Scan(&a.ID, &a.FlightID, &a.Filename, &a.ContentType, &a.Size, &a.CreatedAt)
	if err != nil {
		return nil, &httpError{500, "Database error"}
	}
	return &a, nil
}

// ── POST /api/flights/{id}/attachments ──

func uploadAttachment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		flightID, _ := strconv.Atoi(r.PathValue("id"))
		if err := flightOwnedBy(r, db, flightID, userID); err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentSize)
		if err := r.ParseMultipartForm(maxAttachmentUploadMem); err != nil {
			writeError(w, 422, "File too large or invalid multipart form (max 25 MB)")
			return
		}

		_, header, err := r.FormFile("file")
		if err != nil {
			writeError(w, 422, "Missing file field")
			return
		}

		a, err := saveAttachmentFile(r, db, flightID, userID, header)
		if err != nil {
			if he, ok := err.(*httpError); ok {
				writeError(w, he.Code, he.Message)
			} else {
				writeError(w, 500, "Failed to store file")
			}
			return
		}

		writeJSON(w, 201, a)
	}
}

// ── GET /api/attachments/{id}/download ──

func downloadAttachment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		attachmentID, _ := strconv.Atoi(r.PathValue("id"))

		var a Attachment
		var flightID, ownerID int
		err = db.QueryRowContext(r.Context(),
			"SELECT id, flight_id, user_id, filename, content_type FROM attachments WHERE id = ?",
			attachmentID).Scan(&a.ID, &flightID, &ownerID, &a.Filename, &a.ContentType)
		if err == sql.ErrNoRows || ownerID != userID {
			writeError(w, 404, "Attachment not found")
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		filePath := filepath.Join(attachmentsBaseDir(), strconv.Itoa(ownerID), strconv.Itoa(flightID),
			fmt.Sprintf("%d_%s", attachmentID, a.Filename))
		f, err := os.Open(filePath)
		if err != nil {
			writeError(w, 404, "Attachment file missing")
			return
		}
		defer f.Close()

		w.Header().Set("Content-Type", a.ContentType)
		// Use RFC 5987 encoding for filenames with special characters.
		w.Header().Set("Content-Disposition",
			fmt.Sprintf("attachment; filename*=UTF-8''%s", strings.NewReplacer("%", "%25", " ", "%20", `"`, "%22").Replace(a.Filename)))
		http.ServeContent(w, r, a.Filename, time.Time{}, f)
	}
}

// ── DELETE /api/attachments/{id} ──

func deleteAttachment(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := getUserID(r, db)
		if err != nil {
			he := err.(*httpError)
			writeError(w, he.Code, he.Message)
			return
		}

		attachmentID, _ := strconv.Atoi(r.PathValue("id"))

		var filename string
		var flightID, ownerID int
		err = db.QueryRowContext(r.Context(),
			"SELECT flight_id, user_id, filename FROM attachments WHERE id = ?",
			attachmentID).Scan(&flightID, &ownerID, &filename)
		if err == sql.ErrNoRows || ownerID != userID {
			writeError(w, 404, "Attachment not found")
			return
		}
		if err != nil {
			writeError(w, 500, "Database error")
			return
		}

		if _, err := db.ExecContext(r.Context(),
			"DELETE FROM attachments WHERE id = ?", attachmentID); err != nil {
			writeError(w, 500, "Database error")
			return
		}

		// Remove the file from disk; log but don't fail if it's already gone.
		filePath := filepath.Join(attachmentsBaseDir(), strconv.Itoa(ownerID), strconv.Itoa(flightID),
			fmt.Sprintf("%d_%s", attachmentID, filename))
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			log.Printf("deleteAttachment remove %s: %v", filePath, err)
		}

		w.WriteHeader(204)
	}
}

// deleteAttachmentsForFlight removes all attachment rows and files for a flight.
// Called when a flight is deleted or when all of a user's flights are wiped.
func deleteAttachmentsForFlight(db *sql.DB, flightID int) {
	// Look up paths before deleting rows.
	rows, err := db.Query("SELECT id, user_id, filename FROM attachments WHERE flight_id = ?", flightID)
	if err != nil {
		log.Printf("deleteAttachmentsForFlight query: %v", err)
		return
	}
	type attRow struct {
		id, userID int
		filename   string
	}
	var atts []attRow
	for rows.Next() {
		var a attRow
		if err := rows.Scan(&a.id, &a.userID, &a.filename); err == nil {
			atts = append(atts, a)
		}
	}
	rows.Close()

	if _, err := db.Exec("DELETE FROM attachments WHERE flight_id = ?", flightID); err != nil {
		log.Printf("deleteAttachmentsForFlight delete rows: %v", err)
	}

	for _, a := range atts {
		p := filepath.Join(attachmentsBaseDir(), strconv.Itoa(a.userID), strconv.Itoa(flightID),
			fmt.Sprintf("%d_%s", a.id, a.filename))
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			log.Printf("deleteAttachmentsForFlight remove %s: %v", p, err)
		}
	}
	// Best-effort cleanup of the (now empty) flight directory.
	if len(atts) > 0 {
		os.Remove(filepath.Join(attachmentsBaseDir(), strconv.Itoa(atts[0].userID), strconv.Itoa(flightID)))
	}
}

// sanitizeFilename strips path separators and other dangerous characters from
// an uploaded filename so it is safe to use on disk.
func sanitizeFilename(name string) string {
	// Keep only the base name (guards against "../../etc/passwd").
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "\\", "_")
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.TrimSpace(name)
	// Disallow hidden files and empty results.
	name = strings.TrimPrefix(name, ".")
	if name == "" {
		return ""
	}
	// Limit length to something reasonable for a filesystem.
	if len(name) > 200 {
		ext := filepath.Ext(name)
		if len(ext) > 20 {
			ext = ext[:20]
		}
		name = name[:200-len(ext)] + ext
	}
	return name
}
