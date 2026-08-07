export type SurfaceTheme = "light" | "dark";

export function surfaceThemeClassName(theme: SurfaceTheme): string {
  return theme === "dark" ? "dark" : "theme-light";
}
