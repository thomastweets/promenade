import type { Locale, LocalizedText, Show } from "./schema"
import { getShowPublicLocales, supportedLocales } from "./schema"

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

export function bestLocalizedValue(
  values: LocalizedText,
  preferredLocales: readonly Locale[] = supportedLocales
) {
  for (const locale of preferredLocales) {
    const value = values[locale]?.trim()

    if (value) {
      return value
    }
  }

  for (const locale of supportedLocales) {
    const value = values[locale]?.trim()

    if (value) {
      return value
    }
  }

  return ""
}

export function localize(
  locale: Locale,
  values: LocalizedText,
  fallbackLocale: Locale = "de"
) {
  return (
    values[locale]?.trim() ||
    values[fallbackLocale]?.trim() ||
    bestLocalizedValue(values)
  )
}

export function getAlternateLocales(
  locale: Locale,
  show: Pick<Show, "locales" | "publicLocales" | "defaultLocale">
) {
  return getShowPublicLocales(show).filter((candidate) => candidate !== locale)
}
