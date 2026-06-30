/** API client for SkyLog backend */

import type { Flight, FlightCreate, DashboardStats } from "./types";

const API_BASE = "/api";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("skylog_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { ...getAuthHeaders(), ...(options?.headers as Record<string, string> | undefined) },
    ...options,
  });
  if (!response.ok) {
    const error = await response.text();
    // If 401 unauthorized, clear token
    if (response.status === 401) {
      localStorage.removeItem("skylog_token");
    }
    throw new Error(error);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  /** Get all flights for the current user */
  listFlights: () => request<Flight[]>("/flights"),

  /** Get a flight by ID */
  getFlight: (id: number) => request<Flight>(`/flights/${id}`),

  /** Create a new flight */
  createFlight: (flight: FlightCreate) =>
    request<Flight>("/flights", {
      method: "POST",
      body: JSON.stringify(flight),
    }),

  /** Update a flight */
  updateFlight: (id: number, flight: Partial<FlightCreate>) =>
    request<Flight>(`/flights/${id}`, {
      method: "PUT",
      body: JSON.stringify(flight),
    }),

  /** Delete a flight */
  deleteFlight: (id: number) =>
    request<void>(`/flights/${id}`, { method: "DELETE" }),

  /** Get dashboard stats for the current user */
  getDashboardStats: () => request<DashboardStats>("/dashboard/stats"),

  /** Health check */
  healthCheck: () => request<{ status: string }>("/health"),

  /** Get current user */
  getCurrentUser: () => request<{ username: string }>("/settings/user"),

  /** Update username */
  updateUsername: (username: string) =>
    request<{ username: string }>("/settings/username", {
      method: "PUT",
      body: JSON.stringify({ username }),
    }),

  /** Change password */
  changePassword: (current_password: string, new_password: string) =>
    request<{ status: string }>("/settings/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),

  /** Check if the current authenticated user is the admin */
  isAdmin: () => request<{ isAdmin: boolean }>("/auth/is-admin"),

  /** Check if any admin user exists */
  hasUser: () => request<{ hasUser: boolean }>("/auth/has-user"),

  /** Login with username and password */
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  /** Create an additional (non-admin) user */
  createUser: (username: string, password: string) =>
    request<{ token: string; username: string }>("/auth/create-user", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  /** Auto-login as admin (only works when multi-user mode is disabled) */
  autoLogin: () =>
    request<{ token: string; username: string }>("/auth/auto-login"),

  /** Get whether multi-user mode is enabled */
  getMultiUserMode: () =>
    request<{ multiUserMode: boolean }>("/auth/multi-user-mode"),

  /** Set multi-user mode (enable or disable). Requires admin + password. */
  setMultiUserMode: (enabled: boolean, password: string) =>
    request<{ multiUserMode: boolean }>("/auth/multi-user-mode", {
      method: "PUT",
      body: JSON.stringify({ enabled, password }),
    }),

  /** Get whether the login page should be shown */
  getShowLogin: () =>
    request<{ showLoginPage: boolean }>("/auth/show-welcome"),

  /** Get currency thresholds for the current user */
  getCurrencyThresholds: () =>
    request<{ thresholds: Record<string, { minCount: number; daysWindow: number }> }>("/currency/thresholds"),

  /** Save currency thresholds for the current user */
  saveCurrencyThresholds: (thresholds: { category_id: string; min_count: number; days_window: number }[]) =>
    request<{ status: string }>("/currency/thresholds", {
      method: "PUT",
      body: JSON.stringify({ thresholds }),
    }),
};
