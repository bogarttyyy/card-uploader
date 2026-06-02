"use client";

import { Moon, Sun } from "lucide-react";

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle("dark");
  window.localStorage.setItem("card-uploader-theme", isDark ? "dark" : "light");
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
    >
      <Moon className="h-5 w-5 dark:hidden" />
      <Sun className="hidden h-5 w-5 dark:block" />
    </button>
  );
}
