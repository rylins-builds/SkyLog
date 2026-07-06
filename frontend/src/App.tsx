/**
 * SkyLog Root Application Component
 *
 * App.tsx is the top-level React component. It handles:
 *
 *   1. **Authentication** — Determines on mount whether to show the
 *      login page, auto-login as admin, or show the authenticated UI.
 *   2. **Navigation** — Renders a sticky header with nav buttons and
 *      conditionally shows the logout button (multi-user mode only).
 *   3. **Page routing** — Renders one of the page components based on
 *      ``currentPage`` state, using custom DOM events for child-to-parent
 *      navigation (``navigate``, ``edit-flight``).
 *   4. **Visibility** — Loads page visibility settings from the backend
 *      API and hides optional nav buttons when toggled off.
 *
 * State is managed with React hooks (useState, useEffect) rather than
 * a router library — the app has only a handful of "pages" and no
 * URL-based routing is needed for this self-hosted single-user SPA.
 *
 * @module App
 */

import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Logbook from "./pages/Logbook";
import Currency from "./pages/Currency";
import FAA8710 from "./pages/FAA8710";
import Settings from "./pages/Settings";
import EntryForm from "./pages/EntryForm";
import LoginPage from "./pages/LoginPage";
import { loadSettings, loadVisibilityFromApi, type PageVisibility, CORE_PAGES } from "./api/settings";
import { api } from "./api/client";

/** The set of top-level pages the user can navigate to. */
type Page = "dashboard" | "logbook" | "currency" | "FAA8710" | "settings" | "add";

export default function App() {
  // ═══ Core State ═══
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  /** If non-null, the id of the flight being edited in EntryForm. */
  const [editingFlightId, setEditingFlightId] = useState<number | null>(null);
  /** Which optional pages (currency, FAA8710) are visible in the nav. */
  const [pageVisibility, setPageVisibility] = useState<PageVisibility>(
    () => loadSettings().pageVisibility
  );
  /** Whether multi-user mode is enabled on the backend. */
  const [multiUserMode, setMultiUserMode] = useState(false);

  // ═══ Auth State Machine ═══
  // We use a three-state enum to avoid showing a flash of the
  // authenticated UI before we know the auth status.
  const [authState, setAuthState] = useState<"loading" | "login" | "authenticated">("loading");

  // ═══════════════════════════════════════════════
  // 1. Initial Auth Check (on mount)
  // ═══════════════════════════════════════════════

  useEffect(() => {
    (async () => {
      try {
        const { multiUserMode: mum } = await api.getMultiUserMode();
        setMultiUserMode(mum);
        if (mum) {
          // Multi-user mode enabled — user must login manually
          const token = localStorage.getItem("skylog_token");
          if (token) {
            // Check if the token is still valid by making a lightweight request
            try {
              await api.getCurrentUser();
              setAuthState("authenticated");
              return;
            } catch {
              // Token expired — clear it and show login
              localStorage.removeItem("skylog_token");
            }
          }
          setAuthState("login");
        } else {
          // Multi-user mode disabled — auto-login as admin
          const res = await api.autoLogin();
          localStorage.setItem("skylog_token", res.token);
          setAuthState("authenticated");
        }
      } catch {
        // Backend unreachable — still try auto-login as fallback
        // (this handles the case where the backend is starting up)
        try {
          const res = await api.autoLogin();
          localStorage.setItem("skylog_token", res.token);
          setAuthState("authenticated");
        } catch {
          setAuthState("login");
        }
      }
    })();
  }, []);

  // ═══════════════════════════════════════════════
  // 2. Load visibility settings after auth
  // ═══════════════════════════════════════════════

  useEffect(() => {
    if (authState !== "authenticated") return;
    loadVisibilityFromApi().then(({ pageVisibility: pv }) => {
      setPageVisibility(pv);
    });
  }, [authState]);

  // ═══════════════════════════════════════════════
  // 3. Listen for settings updates
  // ═══════════════════════════════════════════════

  useEffect(() => {
    const handler = () => {
      setPageVisibility(loadSettings().pageVisibility);
    };
    window.addEventListener("settingsUpdated", handler);
    return () => window.removeEventListener("settingsUpdated", handler);
  }, []);

  // ═══════════════════════════════════════════════
  // 4. Listen for child-component navigation events
  // ═══════════════════════════════════════════════

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "add") {
        setEditingFlightId(null);
        setCurrentPage("add");
      } else if (detail === "settings") {
        setEditingFlightId(null);
        setCurrentPage("settings");
      } else if (detail === "FAA8710") {
        setEditingFlightId(null);
        setCurrentPage("FAA8710");
      } else if (detail === "currency") {
        setEditingFlightId(null);
        setCurrentPage("currency");
      } else if (detail === "logbook") {
        setEditingFlightId(null);
        setCurrentPage("logbook");
      } else if (detail === "dashboard") {
        setEditingFlightId(null);
        setCurrentPage("dashboard");
      }
    };
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, []);

  // ═══════════════════════════════════════════════
  // 5. Listen for edit-flight events from Logbook
  // ═══════════════════════════════════════════════

  useEffect(() => {
    const handler = (e: Event) => {
      const flightId = (e as CustomEvent).detail as number;
      setEditingFlightId(flightId);
      setCurrentPage("add");
    };
    window.addEventListener("edit-flight", handler);
    return () => window.removeEventListener("edit-flight", handler);
  }, []);

  // ═══════════════════════════════════════════════
  // 6. Re-auth when multi-user mode changes
  // ═══════════════════════════════════════════════

  useEffect(() => {
    const handler = async () => {
      try {
        const { multiUserMode: mum } = await api.getMultiUserMode();
        setMultiUserMode(mum);
        if (!mum && authState === "login") {
          const res = await api.autoLogin();
          localStorage.setItem("skylog_token", res.token);
          setAuthState("authenticated");
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("multiUserModeChanged", handler);
    return () => window.removeEventListener("multiUserModeChanged", handler);
  }, [authState]);

  // ═══════════════════════════════════════════════
  // 7. Navigate to dashboard if current page hidden
  // ═══════════════════════════════════════════════

  useEffect(() => {
    if (
      currentPage !== "dashboard" &&
      !CORE_PAGES.includes(currentPage as typeof CORE_PAGES[number]) &&
      !pageVisibility[currentPage as keyof PageVisibility]
    ) {
      setCurrentPage("dashboard");
    }
  }, [pageVisibility, currentPage]);

  // ═══════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════

  const handleAuthenticated = () => {
    setAuthState("authenticated");
  };

  const handleLogout = () => {
    localStorage.removeItem("skylog_token");
    setAuthState("login");
    setCurrentPage("dashboard");
  };

  // ═══════════════════════════════════════════════
  // Render: Loading State
  // ═══════════════════════════════════════════════

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">✈️</div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Render: Login Page
  // ═══════════════════════════════════════════════

  if (authState !== "authenticated") {
    return (
      <LoginPage
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  // ═══════════════════════════════════════════════
  // Render: Authenticated App
  // ═══════════════════════════════════════════════

  /** Define the pages that appear in the navigation bar.
   *  ``alwaysVisible`` means the page cannot be hidden via Settings. */
  const pages: { key: Page; label: string; icon: string; alwaysVisible: boolean }[] = [
    { key: "dashboard", label: "Dashboard", icon: "house", alwaysVisible: true },
    { key: "logbook", label: "Logbook", icon: "book", alwaysVisible: true },
    { key: "currency", label: "Currency", icon: "check", alwaysVisible: false },
    { key: "FAA8710", label: "FAA 8710", icon: "clipboard", alwaysVisible: false },
    { key: "settings", label: "Settings", icon: "gear", alwaysVisible: true },
    { key: "add", label: "New Flight", icon: "plus", alwaysVisible: true },
  ];

  // Filter the page list based on visibility settings
  const visiblePages = pages.filter(
    (p) => p.alwaysVisible || pageVisibility[p.key as keyof PageVisibility]
  );

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-800">
      {/* ════════════════════════════════════════
          Navigation Header (non-scrollable)
          ════════════════════════════════════════ */}
      <header className="bg-white shadow-sm border-b border-gray-200 shrink-0 relative dark:bg-zinc-900 dark:border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">✈️</span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">SkyLog</h1>
            </div>

            {/* Navigation buttons */}
            <nav className="flex gap-1">
              {visiblePages.map(({ key, label, icon }) => (
                <NavButton
                  key={key}
                  active={currentPage === key}
                  onClick={() => {
                    setEditingFlightId(null);
                    setCurrentPage(key);
                  }}
                  highlight={key === "add"}
                >
                  {icon === "house" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  )}
                  {icon === "book" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  {icon === "check" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m8 13l3 3l5-7m6 3c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2s10 4.477 10 10" />
                    </svg>
                  )}
                  {icon === "clipboard" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  )}
                  {icon === "gear" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  {icon === "plus" && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">{label}</span>
                </NavButton>
              ))}
            </nav>
          </div>
        </div>

        {/* Logout button — positioned absolutely to the right, outside the max-w-6xl container */}
        {multiUserMode && (
          <div className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════
          Page Content (scrollable, fills remaining height)
          ════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto animate-fade-in" key={`${currentPage}-${editingFlightId ?? "new"}`}>
        {currentPage === "dashboard" && <Dashboard />}
        {currentPage === "logbook" && <Logbook />}
        {currentPage === "currency" && <Currency />}
        {currentPage === "FAA8710" && <FAA8710 />}
        {currentPage === "settings" && <Settings />}
        {currentPage === "add" && <EntryForm editFlightId={editingFlightId} />}
      </main>
    </div>
  );
}

/**
 * A single navigation button in the header bar.
 *
 * @param active - Whether this button corresponds to the current page.
 * @param onClick - Callback when the button is clicked.
 * @param children - Icon + label content.
 * @param highlight - If true, gives the button a blue accent colour
 *   (used for the "New Flight" action button).
 */
function NavButton({
  active,
  onClick,
  children,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-100"
          : highlight
            ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:text-white dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
