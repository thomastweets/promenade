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
  compact?: boolean
}

const optionBaseClass =
  "rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent)]"

function ThemeIcon({ value }: { value: ThemePreference }) {
  if (value === "light") {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" />
      </svg>
    )
  }

  if (value === "dark") {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M14.8 3.4a8.8 8.8 0 1 0 5.8 15.5A9.6 9.6 0 0 1 14.8 3.4Z" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect height="13" rx="2.2" width="18" x="3" y="4" />
      <path d="M8 20h8M10 17v3M14 17v3" />
    </svg>
  )
}

export function ThemeToggle({
  label = "Theme",
  systemLabel = "System",
  lightLabel = "Light",
  darkLabel = "Dark",
  compact = false
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

  if (compact) {
    return (
      <details className="relative">
        <summary
          aria-label={label}
          className="menu-summary flex list-none items-center justify-center rounded-full border border-slate-200/80 bg-white/75 p-3 text-slate-600 shadow-sm backdrop-blur transition hover:text-slate-950 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white"
        >
          <span className="sr-only">{label}</span>
          <ThemeIcon value={preference} />
        </summary>
        <div className="surface-card absolute right-0 top-[calc(100%+0.75rem)] z-20 flex min-w-[12rem] flex-col gap-1 rounded-[1.4rem] border border-white/70 p-2 shadow-xl">
          {[
            { label: systemLabel, value: "system" },
            { label: lightLabel, value: "light" },
            { label: darkLabel, value: "dark" }
          ].map((option) => {
            const active = preference === option.value

            return (
              <button
                aria-pressed={active}
                className={`flex items-center justify-between rounded-[1rem] px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[color:var(--brand-accent)] text-white"
                    : "text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white"
                }`}
                key={option.value}
                onClick={(event) => {
                  choose(option.value as ThemePreference)
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open")
                }}
                type="button"
              >
                <span>{option.label}</span>
                <ThemeIcon value={option.value as ThemePreference} />
              </button>
            )
          })}
        </div>
      </details>
    )
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
