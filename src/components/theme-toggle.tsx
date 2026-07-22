"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "card-uploader-theme";

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("pampi-theme-change", onStoreChange);
      return () => window.removeEventListener("pampi-theme-change", onStoreChange);
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  function toggleTheme() {
    const shouldUseDarkTheme = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", shouldUseDarkTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, shouldUseDarkTheme ? "dark" : "light");
    window.dispatchEvent(new Event("pampi-theme-change"));
  }

  return (
    <button
      type="button"
      aria-label={isDark ? "Use light theme" : "Use dark theme"}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
    >
      <Moon className="h-5 w-5 dark:hidden" />
      <Sun className="hidden h-5 w-5 dark:block" />
    </button>
  );
}
