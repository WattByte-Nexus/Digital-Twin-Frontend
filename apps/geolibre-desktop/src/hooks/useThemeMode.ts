import { useCallback, useLayoutEffect, useState } from "react";
import { THEME_MODE_STORAGE_KEY } from "../lib/storage-keys";

export type ThemeMode = "light" | "dark";

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  // An explicit `?theme=dark` / `?theme=light` overrides the OS preference on
  // load (handy for embeds); the in-app toggle still works afterwards.
  const themeParam = new URLSearchParams(window.location.search).get("theme")?.trim().toLowerCase();
  if (themeParam === "dark" || themeParam === "light") {
    return themeParam;
  }

  try {
    const saved = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Restricted storage still permits OS-based appearance and session toggles.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  useLayoutEffect(() => {
    const isDark = themeMode === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  const toggleThemeMode = useCallback(() => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    try { window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next); } catch { /* Session preference remains usable. */ }
  }, [themeMode]);

  return { themeMode, toggleThemeMode };
}
