import type { Artwork, Locale, Show } from "./schema"
import { supportedLocales } from "./schema"

export function formatArtworkId(value: number | string) {
  const numeric = typeof value === "number" ? value : Number.parseInt(value, 10)
  return `${numeric}`.padStart(2, "0")
}

export function buildLocalePath(locale: Locale, slug = "") {
  return slug ? `/${locale}/${slug.replace(/^\//, "")}` : `/${locale}/`
}

export function buildArtworkPath(locale: Locale, artwork: Pick<Artwork, "id">) {
  return `/${locale}/artworks/${artwork.id}/`
}

export function buildGuideArtworkPath(
  locale: Locale,
  station: number | string
) {
  return `/${locale}/guide/${formatArtworkId(station)}/`
}

export function buildArtworkUrl(
  locale: Locale,
  artwork: Pick<Artwork, "id">,
  siteUrl?: string
) {
  const pathname = buildArtworkPath(locale, artwork)
  return siteUrl ? new URL(pathname, siteUrl).toString() : pathname
}

export function buildGuideArtworkUrl(
  locale: Locale,
  station: number | string,
  siteUrl?: string
) {
  const pathname = buildGuideArtworkPath(locale, station)
  return siteUrl ? new URL(pathname, siteUrl).toString() : pathname
}

export function swapLocaleInPath(pathname: string, targetLocale: Locale) {
  const segments = pathname.split("/").filter(Boolean)

  if (!segments.length) {
    return `/${targetLocale}/`
  }

  if (supportedLocales.includes(segments[0] as Locale)) {
    segments[0] = targetLocale
  } else {
    segments.unshift(targetLocale)
  }

  return `/${segments.join("/")}${pathname.endsWith("/") ? "/" : ""}`
}

export function parseArtworkTargetFromQrInput(
  rawValue: string,
  locale: Locale,
  show: Pick<Show, "id">
) {
  const trimmed = rawValue.trim()

  if (!trimmed) {
    return null
  }

  const directId = trimmed.match(/^(\d{1,3})$/)

  if (directId) {
    return buildGuideArtworkPath(locale, directId[1])
  }

  try {
    const url = trimmed.startsWith("http")
      ? new URL(trimmed)
      : new URL(trimmed, "https://placeholder.local")
    const artworkFromQuery = url.searchParams.get("artwork")

    if (artworkFromQuery) {
      return buildArtworkPath(locale, { id: formatArtworkId(artworkFromQuery) })
    }

    const stationFromQuery = url.searchParams.get("station")

    if (stationFromQuery) {
      return buildGuideArtworkPath(locale, stationFromQuery)
    }

    const segments = url.pathname.split("/").filter(Boolean)
    const guideIndex = segments.findIndex((segment) => segment === "guide")
    if (guideIndex >= 0 && segments[guideIndex + 1]) {
      return buildGuideArtworkPath(locale, segments[guideIndex + 1])
    }
    const artworkIndex = segments.findIndex((segment) => segment === "artworks")

    if (artworkIndex >= 0 && segments[artworkIndex + 1]) {
      return buildArtworkPath(locale, {
        id: formatArtworkId(segments[artworkIndex + 1])
      })
    }

    if (segments.length === 1 && /^\d{1,3}$/.test(segments[0])) {
      return buildGuideArtworkPath(locale, segments[0])
    }
  } catch {
    return `/${locale}/?scan=${encodeURIComponent(trimmed)}&show=${show.id}`
  }

  return null
}
