import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Logbook from "./pages/Logbook";
import Currency from "./pages/Currency";
import FAA8710 from "./pages/FAA8710";
import Settings from "./pages/Settings";
import EntryForm from "./pages/EntryForm";

type Page = "dashboard" | "logbook" | "currency" | "FAA8710" | "settings" | "add";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [editingFlightId, setEditingFlightId] = useState<number | null>(null);

  // Listen for custom navigate events from child components
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

  // Listen for edit-flight events from Logbook
  useEffect(() => {
    const handler = (e: Event) => {
      const flightId = (e as CustomEvent).detail as number;
      setEditingFlightId(flightId);
      setCurrentPage("add");
    };
    window.addEventListener("edit-flight", handler);
    return () => window.removeEventListener("edit-flight", handler);
  }, []);

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-zinc-800">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">✈️</span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">SkyLog</h1>
            </div>

            {/* Navigation */}
            <nav className="flex gap-1">
              <NavButton
                active={currentPage === "dashboard"}
                onClick={() => { setEditingFlightId(null); setCurrentPage("dashboard"); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </NavButton>

              <NavButton
                active={currentPage === "logbook"}
                onClick={() => { setEditingFlightId(null); setCurrentPage("logbook"); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Logbook</span>
              </NavButton>

              <NavButton
                active={currentPage === "currency"}
                onClick={() => { setEditingFlightId(null); setCurrentPage("currency"); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.0" d="m8 13l3 3l5-7m6 3c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2s10 4.477 10 10"></path>
                </svg>
                <span className="hidden sm:inline">Currency</span>
              </NavButton>

              <NavButton
                active={currentPage === "FAA8710"}
                onClick={() => { setEditingFlightId(null); setCurrentPage("FAA8710"); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path fill="currentColor" d="m15 22l-.277.416A.5.5 0 0 0 15.5 22zm-3-2l.277-.416a.5.5 0 0 0-.554 0zm-3 2h-.5a.5.5 0 0 0 .777.416zM8.75 3.537l-.04.499zm1.685-.697l-.381-.324zM6.532 5.686l-.498.04zm2.154-2.154l.04-.498zM5.84 7.435l.324.38zm.697-1.684l.499-.04zm-.747 4.772l-.324.381zm0-3.046l-.324-.381zm.747 4.772l-.498-.04zm-.697-1.684l.324-.38zm2.846 3.903l.04.498zm-2.154-2.154l.498.04zm3.903 2.846l.38-.324zm-1.684-.697l-.04-.498zm4.772.747l.381.324zm-3.046 0l-.381.324zm4.772-.747l.04-.498zm-1.684.697l-.38-.324zm3.903-2.846l.498-.04zm-2.154 2.154l-.04.498zm2.846-3.903l.324.381zm-.697 1.684l-.498.04zm.747-4.772l.324-.381zm0 3.046l-.324-.38zm-.747-4.772l-.498-.04zm.697 1.684l-.324.38zm-2.846-3.903l-.04-.498zm2.154 2.154l.498.04zM13.565 2.84l.381-.324zm1.684.697l.04.499zm-1.726-.747l-.38.324zm-3.046 0l.38.324zM9 14.458l.022-.5zm6.277 7.126l-3-2l-.554.832l3 2zm-3.554-2l-3 2l.554.832l3-2zm1.42-16.47l.042.05l.761-.648l-.042-.05zm2.146.922l.065-.006l-.08-.996l-.065.005zm1.68 1.61l-.005.065l.997.08l.006-.065zm.867 2.17l.05.042l.648-.762l-.05-.042zm.05 2.326l-.05.043l.648.761l.05-.042zm-.921 2.147l.005.065l.997-.08l-.006-.065zm-1.61 1.68l-.066-.005l-.08.997l.065.005zm-2.17.867l-.043.05l.762.648l.042-.05zm-2.327.05l-.043-.05l-.761.648l.042.05zm-2.147-.921l-.065.005l.08.996l.065-.005zm-1.68-1.61l.005-.066l-.997-.08l-.005.065zm-.867-2.17l-.05-.043l-.648.762l.05.042zm-.05-2.327l.05-.043l-.648-.761l-.05.042zm.922-2.147l-.006-.065l-.996.08l.005.065zm1.61-1.68l.065.005l.08-.997l-.065-.005zm2.17-.867l.042-.05l-.762-.648l-.042.05zm-2.105.872a2.5 2.5 0 0 0 2.105-.872l-.762-.648a1.5 1.5 0 0 1-1.263.523zm-1.68 1.61A1.5 1.5 0 0 1 8.645 4.03l.08-.996a2.5 2.5 0 0 0-2.692 2.692zm-.867 2.17a2.5 2.5 0 0 0 .872-2.105l-.997.08a1.5 1.5 0 0 1-.523 1.263zm-.05 2.326a1.5 1.5 0 0 1 0-2.284l-.648-.762a2.5 2.5 0 0 0 0 3.808zm.922 2.147a2.5 2.5 0 0 0-.872-2.104l-.648.761a1.5 1.5 0 0 1 .523 1.263zm1.61 1.68a1.5 1.5 0 0 1-1.616-1.615l-.996-.08a2.5 2.5 0 0 0 2.692 2.693zm4.496.917a1.5 1.5 0 0 1-2.284 0l-.762.648a2.5 2.5 0 0 0 3.808 0zm3.828-2.532a1.5 1.5 0 0 1-1.616 1.616l-.08.996a2.5 2.5 0 0 0 2.693-2.692zm.866-2.17a2.5 2.5 0 0 0-.871 2.105l.996-.08a1.5 1.5 0 0 1 .523-1.263zm.05-2.326a1.5 1.5 0 0 1 0 2.284l.648.762a2.5 2.5 0 0 0 0-3.808zm-.921-2.147a2.5 2.5 0 0 0 .871 2.104l.648-.761a1.5 1.5 0 0 1-.523-1.263zm-1.61-1.68a1.5 1.5 0 0 1 1.615 1.615l.997.08a2.5 2.5 0 0 0-2.693-2.692zm-2.17-.867a2.5 2.5 0 0 0 2.104.872l-.08-.997a1.5 1.5 0 0 1-1.263-.523zm.719-.698a2.5 2.5 0 0 0-3.808 0l.762.648a1.5 1.5 0 0 1 2.284 0zm-3.088 12.37a2.5 2.5 0 0 0-1.794-.877l-.044.999a1.5 1.5 0 0 1 1.076.526zm-1.794-.877a3 3 0 0 0-.311.005l.08.997q.094-.008.187-.003zM9.5 22v-7.542h-1V22zm5.79-8.036a3 3 0 0 0-.312-.005l.044.999q.093-.005.187.003zm-.312-.005a2.5 2.5 0 0 0-1.793.877l.761.648a1.5 1.5 0 0 1 1.076-.526zm-.478.5V22h1v-7.542z"></path>                
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"  stroke-width="2.0" d="m14 8l-3 3l-1-1"></path>
                </svg>
              <span className="hidden sm:inline">FAA 8710</span>
              </NavButton>

              <NavButton
                active={currentPage === "settings"}
                onClick={() => { setEditingFlightId(null); setCurrentPage("settings"); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Settings</span>
              </NavButton>
              
              <NavButton
                active={currentPage === "add"}
                onClick={() => { setEditingFlightId(null); setCurrentPage("add"); }}
                highlight
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Flight</span>
              </NavButton>
            </nav>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="animate-fade-in" key={`${currentPage}-${editingFlightId ?? "new"}`}>
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