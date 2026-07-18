/**
 * StatTile — a simple card that displays a labeled metric with an icon.
 *
 * Used by single-column stat tiles (total flights, hours, landings, etc.).
 *
 * @module dashboard/tiles/StatTile
 */

interface StatTileProps {
  label: string;
  value: number | string;
  icon?: string;
}

export function StatTile({ label, value, icon }: StatTileProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 stat-card animate-slide-up dark:bg-zinc-900 dark:border-zinc-400">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400">
          {label}
        </p>
        {icon && <span className="text-lg sm:text-xl">{icon}</span>}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
