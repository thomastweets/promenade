import { getAuthoritativeArtworkTitle } from "./artwork-title"
import type { Artwork, Locale } from "./schema"

export function didLocaleNarrationInputsChange(
  current: Artwork,
  next: Artwork,
  locale: Locale
) {
  return current.description[locale].trim() !== next.description[locale].trim()
}

export function didLocaleCueInputsChange(
  current: Artwork,
  next: Artwork,
  locale: Locale
) {
  return (
    current.artist.trim() !== next.artist.trim() ||
    current.year.trim() !== next.year.trim() ||
    getAuthoritativeArtworkTitle(current, locale) !==
      getAuthoritativeArtworkTitle(next, locale) ||
    current.description[locale].trim() !== next.description[locale].trim() ||
    current.material[locale].trim() !== next.material[locale].trim()
  )
}

export function applyDerivedGenerationStatuses(
  current: Artwork,
  next: Artwork,
  locales: readonly Locale[]
) {
  const updated = structuredClone(next)

  for (const locale of locales) {
    const narrationChanged = didLocaleNarrationInputsChange(
      current,
      updated,
      locale
    )
    const cueInputsChanged = didLocaleCueInputsChange(current, updated, locale)
    const cueChanged =
      current.audioCues[locale].trim() !== updated.audioCues[locale].trim()

    if (cueInputsChanged && !cueChanged) {
      updated.audioCueStatus[locale] = updated.audioCues[locale].trim()
        ? "draft"
        : "missing"
    } else if (cueChanged) {
      updated.audioCueStatus[locale] = updated.audioCues[locale].trim()
        ? "ready"
        : "missing"
    }

    if (narrationChanged) {
      updated.audioStatus[locale] = updated.audio[locale].trim()
        ? "draft"
        : "missing"
    }
  }

  return updated
}
