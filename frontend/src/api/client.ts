/**
 * SkyLog API Client
 *
 * A thin wrapper around the browser's native `fetch()` API for all
 * communication with the SkyLog backend. Every authenticated request
 * automatically attaches the Bearer token from localStorage.
 *
 * The `api` object is the single export — a namespace of async functions
 * organised by domain (flights, auth, settings, currency). Components
 * import and call these directly without ever dealing with raw fetch calls.
 *
 * Error handling:
 *   - Non-2xx responses are thrown as Error with the body text.
 *   - 401 responses automatically clear the stored token (forcing re-login).
 *   - 204 responses (DELETE) return undefined.
 *
 * @module api/client
 */

import type { Flight, FlightCreate, DashboardStats } from "./types";

/** Base URL for all API requests. The Vite dev server proxies /api
 *  to the backend (configured in vite.config.ts). In production,
 *  the same origin serves both frontend and backend.
 */
const API_BASE = "/api";

/**
 * Build the headers object for an API request.
 * Automatically includes the Content-Type and, if available,
 * the Authorization header with the user's Bearer token.
 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("skylog_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Core request helper. Every public API function delegates to this.
 *
 * @param url - The path relative to API_BASE (e.g. "/flights").
 * @param options - Standard fetch options (method, body, etc.).
 * @returns The parsed JSON response, or undefined for 204 No Content.
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { ...getAuthHeaders(), ...(options?.headers as Record<string, string> | undefined) },
    ...options,
  });
  if (!response.ok) {
    const error = await response.text();
    // If 401 (unauthorized / token expired), clear the stored token
    // so the app redirects to login on the next render cycle.
    if (response.status === 401) {
      localStorage.removeItem("skylog_token");
    }
    throw new Error(error);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/**
 * Public API: a namespace of typed async functions.
 * Every function returns a Promise that resolves to the expected type
 * or rejects with an Error containing the backend's error message.
 */
export const api = {
  // ═══ Flight CRUD ═══

  /** Get all flights for the current user, ordered by date descending. */
  listFlights: () => request<Flight[]>("/flights"),

  /** Get a single flight by its database ID. */
  getFlight: (id: number) => request<Flight>(`/flights/${id}`),

  /** Create a new flight entry. Returns the created record with its id. */
  createFlight: (flight: FlightCreate) =>
    request<Flight>("/flights", {
      method: "POST",
      body: JSON.stringify(flight),
    }),

  /** Update an existing flight entry (partial update — only provided fields). */
  updateFlight: (id: number, flight: Partial<FlightCreate>) =>
    request<Flight>(`/flights/${id}`, {
      method: "PUT",
      body: JSON.stringify(flight),
    }),

  /** Delete a flight entry by ID. Returns undefined on success. */
  deleteFlight: (id: number) =>
    request<void>(`/flights/${id}`, { method: "DELETE" }),

  /** Delete all flights for the current user. Returns count of deleted rows. */
  wipeFlights: () =>
    request<{ deleted: number }>("/flights", { method: "DELETE" }),

  // ═══ Dashboard ═══

  /** Get aggregated dashboard statistics for the current user. */
  getDashboardStats: () => request<DashboardStats>("/dashboard/stats"),

  // ═══ Health ═══

  /** Simple health-check ping. */
  healthCheck: () => request<{ status: string }>("/health"),

  // ═══ User Settings ═══

  /** Get the current user's username. */
  getCurrentUser: () => request<{ username: string }>("/settings/user"),

  /** Update the username for the current user. */
  updateUsername: (username: string) =>
    request<{ username: string }>("/settings/username", {
      method: "PUT",
      body: JSON.stringify({ username }),
    }),

  /** Change the current user's password (requires current password for verification). */
  changePassword: (current_password: string, new_password: string) =>
    request<{ status: string }>("/settings/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),

  // ═══ Auth ═══

  /** Check if the currently authenticated user is the admin (user id = 1). */
  isAdmin: () => request<{ isAdmin: boolean }>("/auth/is-admin"),

  /** Check if any admin user exists (always true since admin is auto-created). */
  hasUser: () => request<{ hasUser: boolean }>("/auth/has-user"),

  /** Login with username and password. Returns a session token + username. */
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  /** Create an additional (non-admin) user. Returns token + username. */
  createUser: (username: string, password: string) =>
    request<{ token: string; username: string }>("/auth/create-user", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  /** Auto-login as admin (only works when multi-user mode is disabled). */
  autoLogin: () =>
    request<{ token: string; username: string }>("/auth/auto-login"),

  /** Get whether multi-user mode is currently enabled. */
  getMultiUserMode: () =>
    request<{ multiUserMode: boolean }>("/auth/multi-user-mode"),

  /** Enable or disable multi-user mode. Requires admin auth + password. */
  setMultiUserMode: (enabled: boolean, password: string) =>
    request<{ multiUserMode: boolean }>("/auth/multi-user-mode", {
      method: "PUT",
      body: JSON.stringify({ enabled, password }),
    }),

  /** Get whether the login page should be shown (mirrors multi-user mode). */
  getShowLogin: () =>
    request<{ showLoginPage: boolean }>("/auth/show-welcome"),

  // ═══ Currency ═══

  /** Get currency thresholds for the current user. */
  getCurrencyThresholds: () =>
    request<{ thresholds: Record<string, { minCount: number; daysWindow: number }> }>("/currency/thresholds"),

  /** Save currency thresholds for the current user. */
  saveCurrencyThresholds: (thresholds: { category_id: string; min_count: number; days_window: number }[]) =>
    request<{ status: string }>("/currency/thresholds", {
      method: "PUT",
      body: JSON.stringify({ thresholds }),
    }),

  // ═══ Visibility ═══

  /** Get page and column visibility preferences for the current user. */
  getVisibility: () =>
    request<{ pageVisibility: string; columnVisibility: string }>("/settings/visibility"),

  /** Save page and column visibility preferences for the current user. */
  saveVisibility: (pageVisibility: string, columnVisibility: string) =>
    request<{ status: string }>("/settings/visibility", {
      method: "PUT",
      body: JSON.stringify({ page_visibility: pageVisibility, column_visibility: columnVisibility }),
    }),

  // ═══ Glider Launch Type Check ═══

  /** Check whether the current user has any flights with a glider/LTA launch type logged. */
  hasGliderLaunchType: () =>
    request<{ hasGliderLaunchType: boolean }>("/settings/has-glider-launch-type"),
};
