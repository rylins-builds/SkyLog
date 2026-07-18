# SkyLog

A privacy-first, self-hosted digital flight logbook for pilots. Track flights, maintain currency, and manage your aviation records — all on your own infrastructure.

## Features

- **✈️ Dashboard** — Fully customizable stat-tile dashboard with drag-and-drop reordering, show/hide toggles for 34+ tile types covering all flight time categories (SEL/SES/MEL/MES, helicopter, glider, etc.), instrument approaches, night operations, and 30-day totals. Recent flights table always shown below the tile grid. Layout persists per user.
- **📖 Logbook** — Full-featured flight table with search, sort, pagination, and configurable column visibility.
- **✈️ Log / Edit Flights** — Full flight entry form covering all time categories (SEL, SES, MEL, MES, Helicopter, Gyroplane, Powered Lift, Glider, Balloon, Airship), launch types, instrument approaches, holds, night operations, and remarks.
- **📊 Currency Tracker** — Check currency status across day/night takeoffs/landings, instrument approaches, and holding procedures. Configurable thresholds per category.
- **📋 FAA 8710** — Aeronautical experience summary in FAA Form 8710 format with flight time by aircraft/device, class totals (Airplane, Rotorcraft, Lighter-than-Air), glider/airship launch totals, and simulated flight device totals. Supports aircraft type to 8710-category mapping.
- **⚙️ Settings** — Customize page visibility, column visibility per user, change username/password, toggle multi-user mode, and import/export flights as CSV.
- **🔒 Self-Hosted** — Full data ownership. Single-user mode (auto-login) or multi-user mode with authentication.
- **🌙 Dark Mode** — Respects system color scheme preferences.

## Tech Stack

| Layer      | Technology |
|-----------|------------|
| Backend   | Go / net/http |
| Database  | SQLite (WAL mode) |
| Frontend  | React 19 / TypeScript / Vite 8 / Tailwind CSS 4 |
| Auth      | Bearer token sessions + SHA-256 salted passwords |
| Container | Docker / Compose |

## Quick Start

### Using Docker (recommended)

```bash
docker compose up -d
```

Then open **http://localhost:3000** in your browser.

On first start the app auto-creates an admin user and logs you in directly (single-user mode). To enable password-based login, visit Settings → Multi-User Mode.

### Manual Development Setup

**Backend:**
```bash
cd backend-go
go run .
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # opens at http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:3000` (the Go backend).

## Project Structure

```
skylog/
├── backend-go/
│   ├── main.go              # Entry point, HTTP router, CORS, static files
│   ├── database.go           # SQLite connection & schema init
│   ├── models.go             # Go structs (Flight, User, etc.)
│   ├── flights.go            # Flight CRUD + dashboard stats
│   ├── faa8710.go            # FAA 8710 aircraft type mappings
│   ├── settings.go           # Auth, settings, currency, visibility
│   ├── go.mod
│   └── go.sum
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Root layout, routing, auth state machine
│   │   ├── main.tsx              # React entry point
│   │   ├── index.css             # Tailwind imports, animations, skeleton styles
│   │   ├── api/
│   │   │   ├── client.ts         # Fetch-based API client
│   │   │   ├── types.ts          # TypeScript interfaces (Flight, DashboardStats)
│   │   │   └── settings.ts       # localStorage + API persistence helpers
│   │   ├── dashboard/
│   │   │   ├── types.ts           # TileType union, DashboardTileConfig interface
│   │   │   ├── tileRegistry.ts    # Central registry of all 34+ tile types
│   │   │   ├── DashboardCustomizer.tsx # Slide-over panel for show/hide tiles
│   │   │   └── tiles/
│   │   │       ├── StatTile.tsx        # Single stat card component
│   │   │       └── RecentFlightsTile.tsx # Recent flights compact table
│   │   └── pages/
│   │       ├── Dashboard.tsx      # Customizable tile grid with drag-and-drop reordering
│   │       ├── Logbook.tsx        # Searchable, sortable flight table
│   │       ├── EntryForm.tsx      # Create / edit flight form
│   │       ├── Currency.tsx       # Currency tracker with progress bars
│   │       ├── FAA8710.tsx        # FAA 8710 experience grid, class totals, mappings
│   │       ├── Settings.tsx       # Page/column visibility, CSV import/export
│   │       └── LoginPage.tsx      # Login / registration UI
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── Dockerfile
└── skylog_data/                  # Persistent SQLite DB volume (Docker)
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | default | Customizable tile grid (34+ stat types), drag-and-drop reordering, show/hide tiles, recent flights table |
| **Logbook** | click | Full flight table with search, sort, pagination |
| **New Flight** | click | Add a flight with all FAR Part 61 time categories |
| **Currency** | click | Track currency across 6 categories with configurable thresholds |
| **FAA 8710** | click | Aeronautical experience grid in Form 8710 format with class totals and aircraft type mapping |
| **Settings** | click | Visibility toggles, user preferences, CSV import/export |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/flights` | List all flights |
| POST | `/api/flights` | Create a flight |
| GET | `/api/flights/{id}` | Get a flight |
| PUT | `/api/flights/{id}` | Update a flight |
| DELETE | `/api/flights/{id}` | Delete a flight |
| GET | `/api/dashboard/stats` | Aggregated flight stats |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/create-user` | Register |
| GET | `/api/auth/auto-login` | Auto-login (single-user mode) |
| GET/PUT | `/api/auth/multi-user-mode` | Toggle multi-user mode |
| GET | `/api/settings/user` | Get current username |
| PUT | `/api/settings/username` | Update username |
| PUT | `/api/settings/password` | Change password |
| GET/PUT | `/api/settings/visibility` | Page/column visibility |
| GET/PUT | `/api/currency/thresholds` | Currency thresholds |
| GET/PUT | `/api/faa8710/mappings` | FAA 8710 aircraft type mappings |

## License

MIT
