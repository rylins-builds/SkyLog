# SkyLog

A privacy-first, self-hosted digital flight logbook for pilots. Track flights, maintain currency, and manage your aviation records — all on your own infrastructure.

## Features

- **📊 Dashboard** — At-a-glance stats: total flights, hours, night time, landings, unique aircraft, and 30-day totals.
- **📖 Logbook** — Full-featured flight table with search, sort, pagination, and configurable column visibility.
- **✈️ Log / Edit Flights** — Add new flights or edit existing ones with a comprehensive form covering all 14 CFR Part 61 categories (SEL, SES, MEL, MES, Helicopter, Glider, Solo, PIC, SIC, Dual, Instructor, Cross-Country, Night, Instrument).
- **🛡️ Currency Tracker** — Check currency status across day/night takeoffs/landings, instrument approaches, and holding procedures. Configurable thresholds per category.
- **📋 FAA 8710 Prep** — Future hub for pre-populating FAA Form 8710 from logbook data.
- **⚙️ Settings** — Customize page visibility, column visibility per user, change username/password, toggle multi-user mode, and import/export flights as CSV.
- **🔒 Self-Hosted** — Full data ownership. Single-user mode (auto-login) or multi-user mode with authentication.
- **🌙 Dark Mode** — Respects system color scheme preferences.

## Tech Stack

| Layer      | Technology |
|-----------|------------|
| Backend   | Python 3.12 / FastAPI |
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
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # opens at http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

## Project Structure

```
skylog/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, lifespan, static files
│   │   ├── database.py           # SQLite connection & schema init
│   │   ├── schemas.py            # Pydantic models (Flight, User, etc.)
│   │   └── routers/
│   │       ├── flights.py        # Flight CRUD + dashboard stats
│   │       └── settings.py       # Auth, settings, currency, visibility
│   ├── requirements.txt
│   └── static/                   # Built frontend (production)
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
│   │   └── pages/
│   │       ├── Dashboard.tsx      # Stat cards + recent flights
│   │       ├── Logbook.tsx        # Searchable, sortable flight table
│   │       ├── EntryForm.tsx      # Create / edit flight form
│   │       ├── Currency.tsx       # Currency tracker with progress bars
│   │       ├── FAA8710.tsx        # FAA Form 8710 stub
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
| **Dashboard** | default | 6 stat cards + recent flights table |
| **Logbook** | click | Full flight table with search, sort, pagination |
| **New Flight** | click | Add a flight with all FAR Part 61 time categories |
| **Currency** | click | Track currency across 6 categories with configurable thresholds |
| **FAA 8710** | click | Placeholder for future 8710 form generation |
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

## License

MIT
