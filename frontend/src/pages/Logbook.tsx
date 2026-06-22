import { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import type { Flight } from "../api/types";

const PAGE_SIZE = 15;

type SortField = "date" | "total_time" | "aircraft_type" | "aircraft_reg" | "departure" | "arrival" | "sel_time" | "ses_time" | "mel_time" | "mes_time" | "helicopter_time" | "glider_time" | "pic_time" | "sic_time" | "dual_time" | "instructor_time" | "xcountry_time" | "night_time";
type SortDir = "asc" | "desc";
type FilterKey = "sel_time" | "ses_time" | "mel_time" | "mes_time" | "helicopter_time" | "glider_time" | "pic_time" | "sic_time" | "dual_time" | "instructor_time" | "xcountry_time" | "night_time" | "";

export default function Logbook() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const [activeFilter, setActiveFilter] = useState<FilterKey>("");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-3 rounded-lg">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to load flights: {error}</span>
        </div>
      </div>
    );
  }

  // Filter by search term
  const q = search.toLowerCase().trim();
  let filtered = q
    ? flights.filter(
        (f) =>
          f.aircraft_type.toLowerCase().includes(q) ||
          f.aircraft_reg.toLowerCase().includes(q) ||
          f.departure.toLowerCase().includes(q) ||
          f.arrival.toLowerCase().includes(q) ||
          f.pilot_in_command.toLowerCase().includes(q) ||
          (f.remarks && f.remarks.toLowerCase().includes(q))
      )
    : [...flights];

  // Apply quick filter
  if (activeFilter === "sel_time") filtered = filtered.filter((f) => f.sel_time > 0);
  if (activeFilter === "ses_time") filtered = filtered.filter((f) => f.ses_time > 0);
  if (activeFilter === "mel_time") filtered = filtered.filter((f) => f.mel_time > 0);
  if (activeFilter === "mes_time") filtered = filtered.filter((f) => f.mes_time > 0);
  if (activeFilter === "helicopter_time") filtered = filtered.filter((f) => f.helicopter_time > 0);
  if (activeFilter === "glider_time") filtered = filtered.filter((f) => f.glider_time > 0);
  if (activeFilter === "pic_time") filtered = filtered.filter((f) => f.pic_time > 0);
  if (activeFilter === "sic_time") filtered = filtered.filter((f) => f.sic_time > 0);
  if (activeFilter === "dual_time") filtered = filtered.filter((f) => f.dual_time > 0);
  if (activeFilter === "instructor_time") filtered = filtered.filter((f) => f.instructor_time > 0);
  if (activeFilter === "xcountry_time") filtered = filtered.filter((f) => f.xcountry_time > 0);
  if (activeFilter === "night_time") filtered = filtered.filter((f) => f.night_time > 0);

  // Apply sort
  filtered.sort((a, b) => {
    let aVal: string | number = a[sortField] ?? "";
    let bVal: string | number = b[sortField] ?? "";
    if (typeof aVal === "string" && typeof bVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this flight record?")) return;
    try {
      await api.deleteFlight(id);
      setFlights((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const sortOptions: { label: string; field: SortField }[] = [
    { label: "Date", field: "date" },
    { label: "Total Time", field: "total_time" },
    { label: "Aircraft Type", field: "aircraft_type" },
    { label: "Aircraft Registration", field: "aircraft_reg" },
    { label: "Departure", field: "departure" },
    { label: "Arrival", field: "arrival" },
    { label: "Single Engine Land", field: "sel_time" },
    { label: "Single Engine Sea", field: "ses_time" },
    { label: "Multi Engine Land", field: "mel_time" },
    { label: "Multi Engine Sea", field: "mes_time" },
    { label: "Helicopter", field: "helicopter_time" },
    { label: "Glider", field: "glider_time" },
    { label: "PIC", field: "pic_time" },
    { label: "SIC", field: "sic_time" },
    { label: "Dual Received", field: "dual_time" },
    { label: "Instructor", field: "instructor_time" },
    { label: "Cross Country", field: "xcountry_time" },
    { label: "Night", field: "night_time" },
  ];

  const filterOptions: { label: string; key: FilterKey }[] = [
    { label: "Single Engine Land", key: "sel_time" },
    { label: "Single Engine Sea", key: "ses_time" },
    { label: "Multi Engine Land", key: "mel_time" },
    { label: "Multi Engine Sea", key: "mes_time" },
    { label: "Helicopter", key: "helicopter_time" },
    { label: "Glider", key: "glider_time" },
    { label: "PIC", key: "pic_time" },
    { label: "SIC", key: "sic_time" },
    { label: "Dual Received", key: "dual_time" },
    { label: "Instructor", key: "instructor_time" },
    { label: "Cross Country", key: "xcountry_time" },
    { label: "Night", key: "night_time" },
  ];

  const activeSortLabel = sortOptions.find((o) => o.field === sortField)?.label ?? "Date";
  const activeFilterLabel = filterOptions.find((o) => o.key === activeFilter)?.label;

  // Empty state — no flights at all
  if (flights.length === 0) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="max-w-md mx-auto py-16">
          <div className="text-6xl mb-4">📖</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No flights logged yet</h2>
          <p className="text-gray-500 mb-6">
            Ready for takeoff? Add your first flight to get started.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "add" }))}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors btn-primary"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Flight
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Logbook</h1>
        <div className="flex items-center gap-2">

          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => { setShowSortMenu((v) => !v); setShowFilterMenu(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showSortMenu
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <span>{activeSortLabel}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sort by</div>
                {sortOptions.map((opt) => (
                  <button
                    key={opt.field}
                    onClick={() => {
                      if (sortField === opt.field) {
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setSortField(opt.field);
                        setSortDir("desc");
                      }
                      setPage(0);
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      sortField === opt.field ? "text-blue-600 font-medium" : "text-gray-700"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortField === opt.field && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {sortDir === "desc"
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m-5-4v12m0 0l-4-4m4 4l4-4" />
                        }
                      </svg>
                    )}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Direction</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setSortDir("asc"); setPage(0); setShowSortMenu(false); }}
                      className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${sortDir === "asc" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >↑ Asc</button>
                    <button
                      onClick={() => { setSortDir("desc"); setPage(0); setShowSortMenu(false); }}
                      className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${sortDir === "desc" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >↓ Desc</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => { setShowFilterMenu((v) => !v); setShowSortMenu(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activeFilter
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : showFilterMenu
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              <span>{activeFilterLabel ?? "Filter"}</span>
              {activeFilter && (
                <span
                  onClick={(e) => { e.stopPropagation(); setActiveFilter(""); setPage(0); }}
                  className="ml-0.5 w-4 h-4 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 flex items-center justify-center text-xs leading-none cursor-pointer"
                >×</span>
              )}
              {!activeFilter && (
                <svg className={`w-3.5 h-3.5 transition-transform ${showFilterMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Filter by</div>
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setActiveFilter(activeFilter === opt.key ? "" : opt.key);
                      setPage(0);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      activeFilter === opt.key ? "text-amber-700 font-medium" : "text-gray-700"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {activeFilter === opt.key && (
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
                {activeFilter && (
                  <>
                    <div className="border-t border-gray-100 mt-1" />
                    <button
                      onClick={() => { setActiveFilter(""); setPage(0); setShowFilterMenu(false); }}
                      className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      Clear filter
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search flights..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-2 text-gray-500">
            <p className="text-lg">No flights match your search{activeFilter ? " or filter" : ""}.</p>
            <button
              onClick={() => { setSearch(""); setActiveFilter(""); setPage(0); }}
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 underline"
            >
              Clear search{activeFilter ? " and filter" : ""}
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Aircraft Type</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Aircraft Registration</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">From</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">To</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Total Time</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Single Engine Land</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Single Engine Sea</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Multi Engine Land</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Single Engine Sea</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Helicopter</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Glider</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">PIC</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">SIC</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Dual Received</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Instructor</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Cross Country</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Night</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Actual Instrument</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Hooded Instrument</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Flight Simulator</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Remarks</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((flight, idx) => (
                    <tr
                      key={flight.id}
                      className="border-b border-gray-100 hover:bg-gray-50 logbook-row"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.aircraft_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.aircraft_reg}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.departure}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.arrival}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.total_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.sel_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.ses_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.mel_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.mes_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.helicopter_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.glider_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.pic_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.sic_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.dual_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.instructor_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.xcountry_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.night_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.act_instrument_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.sim_instrument_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.sim_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{flight.remarks}</td>
                      <td className="px-4 py-3 row-actions whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent("edit-flight", { detail: flight.id }))}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit flight"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(flight.id)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete flight"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                <span>
                  Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} flights
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="px-3 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                    const pg = start + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          pg === safePage
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        {pg + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="px-3 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
