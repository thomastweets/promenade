export const THEME_STORAGE_KEY = "promenade-theme"

export type ThemePreference = "system" | "light" | "dark"
export type ResolvedTheme = "light" | "dark"

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark"
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean
): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light"
  }

  return preference
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system"
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemePreference(stored) ? stored : "system"
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "light" as ResolvedTheme
  }

  const resolved = resolveTheme(
    preference,
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
  const root = document.documentElement

  root.dataset.themePreference = preference
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  root.classList.toggle("dark", resolved === "dark")

  return resolved
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, preference)
}
