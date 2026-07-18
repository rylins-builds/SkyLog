/**
 * SkyLog Theme Management
 *
 * Supports three modes:
 *   - "system": follows the OS preference via prefers-color-scheme
 *   - "light": always light
 *   - "dark": always dark
 *
 * Persisted to localStorage under the key "skylog_theme".
 * The ".dark" class is applied/removed on <html> to control Tailwind's
 * dark variant.
 *
 * @module api/theme
 */

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "skylog_theme";

/** Read the persisted theme preference. */
export function getThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "system" || raw === "light" || raw === "dark") return raw;
  } catch {
    // localStorage unavailable
  }
  return "system";
}

/** Persist the theme preference and apply it immediately. */
export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable
  }
  applyTheme(mode);
}

/** Remove any persisted theme preference (falls back to system). */
export function clearThemeMode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
  applyTheme("system");
}

/**
 * Apply the given theme mode to the DOM by toggling the `.dark` class
 * on `<html>`.
 *
 * For "system" mode, we listen for changes to `prefers-color-scheme`
 * and update the class accordingly. The returned cleanup function
 * should be called on unmount if used in a component.
 */
export function applyTheme(mode: ThemeMode): (() => void) | void {
  const html = document.documentElement;

  function setDark(isDark: boolean) {
    html.classList.toggle("dark", isDark);
  }

  if (mode === "light") {
    setDark(false);
    return;
  }

  if (mode === "dark") {
    setDark(true);
    return;
  }

  // mode === "system"
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  setDark(mql.matches);

  const listener = (e: MediaQueryListEvent) => setDark(e.matches);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}
