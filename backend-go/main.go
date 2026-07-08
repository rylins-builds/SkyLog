package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
)

func main() {
	// ── Database ──
	db, err := openDB()
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	if err := initDB(context.Background(), db); err != nil {
		log.Fatalf("Failed to initialise database: %v", err)
	}

	log.Println("Database initialised")

	// ── HTTP router ──
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /api/health", healthCheck)

	// Flight CRUD + dashboard
	registerFlightRoutes(mux, db)

	// Auth, settings, currency
	registerSettingsRoutes(mux, db)

	// ── Determine port ──
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// ── Wrap with CORS + optional static file serving ──
	handler := corsMiddleware(mux)

	// In production, serve the pre-built frontend from the "static/" directory.
	// If the directory exists, non-API requests are handled by the SPA static
	// files with an index.html fallback for client-side routing.
	staticDir := "static"
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		handler = withStaticFallback(handler, staticDir)
		log.Printf("Serving static files from %s/", staticDir)
	}

	// ── Graceful shutdown ──
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		if err := srv.Shutdown(context.Background()); err != nil {
			log.Printf("Shutdown error: %v", err)
		}
	}()

	log.Printf("SkyLog Go backend listening on :%s", port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
	log.Println("Server stopped")
}

// ── GET /api/health ──

func healthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "healthy"})
}

// ── CORS middleware ──

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ── SPA static file fallback ──
// After all API routes are registered, this handler serves static files
// for any non-API path. If the requested file doesn't exist, it falls back
// to index.html so that client-side routing (e.g. /logbook, /settings) works.
func withStaticFallback(apiHandler http.Handler, staticDir string) http.Handler {
	fs := http.FileServer(http.Dir(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// API paths go straight to the mux
		if strings.HasPrefix(r.URL.Path, "/api/") {
			apiHandler.ServeHTTP(w, r)
			return
		}

		// Try serving the exact file if it exists
		cleanPath := filepath.Clean(r.URL.Path)
		fullPath := filepath.Join(staticDir, cleanPath)
		if _, err := os.Stat(fullPath); err == nil {
			fs.ServeHTTP(w, r)
			return
		}

		// SPA fallback — serve index.html for any non-API, non-file path
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}
