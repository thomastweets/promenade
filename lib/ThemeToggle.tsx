import {
  applyThemePreference,
  persistThemePreference,
  readThemePreference,
  type ThemePreference
} from "@lib/theme"
import { useEffect, useState } from "react"

type Props = {
  label?: string
  systemLabel?: string
  lightLabel?: string
  darkLabel?: string
}

const optionBaseClass =
  "rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent)]"

export function ThemeToggle({
  label = "Theme",
  systemLabel = "System",
  lightLabel = "Light",
  darkLabel = "Dark"
}: Props) {
  const [preference, setPreference] = useState<ThemePreference>("system")

  useEffect(() => {
    const nextPreference = readThemePreference()
    setPreference(nextPreference)
    applyThemePreference(nextPreference)

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const syncSystemTheme = () => {
      if (readThemePreference() === "system") {
        setPreference("system")
        applyThemePreference("system")
      }
    }
    const syncStorage = () => {
      const updatedPreference = readThemePreference()
      setPreference(updatedPreference)
      applyThemePreference(updatedPreference)
    }

    media.addEventListener("change", syncSystemTheme)
    window.addEventListener("storage", syncStorage)

    return () => {
      media.removeEventListener("change", syncSystemTheme)
      window.removeEventListener("storage", syncStorage)
    }
  }, [])

  function choose(nextPreference: ThemePreference) {
    setPreference(nextPreference)
    persistThemePreference(nextPreference)
    applyThemePreference(nextPreference)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400 lg:inline">
        {label}
      </span>
      <div className="flex items-center rounded-full border border-slate-200/80 bg-white/75 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
        {[
          { label: systemLabel, value: "system" },
          { label: lightLabel, value: "light" },
          { label: darkLabel, value: "dark" }
        ].map((option) => {
          const active = preference === option.value

          return (
            <button
              aria-pressed={active}
              className={`${optionBaseClass} ${
                active
                  ? "bg-[color:var(--brand-accent)] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              }`}
              key={option.value}
              onClick={() => choose(option.value as ThemePreference)}
              type="button"
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
