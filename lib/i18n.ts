import type { Locale } from "./schema"
import { supportedLocales } from "./schema"

const localeSet = new Set<Locale>(supportedLocales)

export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) {
    return null
  }

  const short = value.toLowerCase().split("-")[0]
  return localeSet.has(short as Locale) ? (short as Locale) : null
}

export function resolvePreferredLocale(options: {
  urlLocale?: string | null
  savedLocale?: string | null
  browserLocales?: string[] | readonly string[]
  fallbackLocale?: Locale
}): Locale {
  const fallbackLocale = options.fallbackLocale ?? "de"
  const directMatch =
    normalizeLocale(options.urlLocale) ?? normalizeLocale(options.savedLocale)

  if (directMatch) {
    return directMatch
  }

  for (const browserLocale of options.browserLocales ?? []) {
    const browserMatch = normalizeLocale(browserLocale)

    if (browserMatch) {
      return browserMatch
    }
  }

  return fallbackLocale
}

export function localize(locale: Locale, values: Record<Locale, string>) {
  return values[locale] || values.de
}

export function otherLocale(locale: Locale): Locale {
  return locale === "de" ? "en" : "de"
}
