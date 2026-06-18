import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Logbook from "./pages/Logbook";
import EntryForm from "./pages/EntryForm";

type Page = "dashboard" | "logbook" | "add";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">SkyLog</h1>
            <nav className="flex gap-1">
              <NavButton
                active={currentPage === "dashboard"}
                onClick={() => setCurrentPage("dashboard")}
              >
                Dashboard
              </NavButton>
              <NavButton
                active={currentPage === "logbook"}
                onClick={() => setCurrentPage("logbook")}
              >
                Logbook
              </NavButton>
              <NavButton
                active={currentPage === "add"}
                onClick={() => setCurrentPage("add")}
              >
                + New Flight
              </NavButton>
            </nav>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main>
        {currentPage === "dashboard" && <Dashboard />}
        {currentPage === "logbook" && <Logbook />}
        {currentPage === "add" && <EntryForm />}
      </main>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}