import { bestLocalizedValue } from "./i18n"
import {
  type Artwork,
  type ArtworkTitleLocale,
  artworkTitleLocaleSchema,
  createLocaleRecord,
  type Locale,
  type LocalizedText,
  supportedLocales
} from "./schema"

type ArtworkTitleLike = Pick<Artwork, "title" | "titleLocale" | "titleSubtitle">

function normalizeTitleLocaleValue(
  value?: string | null
): ArtworkTitleLocale | null {
  const parsed = artworkTitleLocaleSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function isSupportedTitleLocale(
  value: ArtworkTitleLocale | null
): value is Locale {
  return value !== null && supportedLocales.includes(value as Locale)
}

function resolveArtworkTitleValueLocale(
  artwork: Pick<Artwork, "title" | "titleLocale">,
  fallbackLocale: Locale = "de"
) {
  const explicitLocale = normalizeTitleLocaleValue(artwork.titleLocale)

  if (
    isSupportedTitleLocale(explicitLocale) &&
    artwork.title[explicitLocale]?.trim()
  ) {
    return explicitLocale
  }

  for (const locale of supportedLocales) {
    if (artwork.title[locale]?.trim()) {
      return locale
    }
  }

  return fallbackLocale
}

export function resolveArtworkTitleLocale(
  artwork: Pick<Artwork, "title" | "titleLocale">,
  fallbackLocale: Locale = "de"
) {
  return (
    normalizeTitleLocaleValue(artwork.titleLocale) ??
    resolveArtworkTitleValueLocale(artwork, fallbackLocale)
  )
}

export function getAuthoritativeArtworkTitle(
  artwork: Pick<Artwork, "title" | "titleLocale">,
  fallbackLocale: Locale = "de"
) {
  const titleLocale = resolveArtworkTitleValueLocale(artwork, fallbackLocale)

  return (
    artwork.title[titleLocale]?.trim() ||
    bestLocalizedValue(artwork.title, [titleLocale, fallbackLocale]) ||
    ""
  )
}

export function getArtworkTitleSubtitle(
  artwork: ArtworkTitleLike,
  locale: Locale
) {
  const titleLocale = normalizeTitleLocaleValue(artwork.titleLocale)
  const subtitle = artwork.titleSubtitle[locale]?.trim() || ""
  const authoritativeTitle = getAuthoritativeArtworkTitle(artwork, locale)

  if (
    !subtitle ||
    titleLocale === locale ||
    subtitle.toLowerCase() === authoritativeTitle.toLowerCase()
  ) {
    return ""
  }

  return subtitle
}

export function getArtworkTitleParts(
  artwork: ArtworkTitleLike,
  locale: Locale
) {
  return {
    title: getAuthoritativeArtworkTitle(artwork, locale),
    subtitle: getArtworkTitleSubtitle(artwork, locale),
    titleLocale: resolveArtworkTitleLocale(artwork, locale)
  }
}

export function getArtworkDisplayTitle(
  artwork: ArtworkTitleLike,
  locale: Locale
) {
  const { subtitle, title } = getArtworkTitleParts(artwork, locale)
  return subtitle ? `${title} (${subtitle})` : title
}

export function createAuthoritativeTitleRecord(title: string): LocalizedText {
  return createLocaleRecord(title.trim())
}

export function normalizeArtworkTitleFields<T extends ArtworkTitleLike>(
  artwork: T,
  fallbackLocale: Locale = "de"
) {
  const titleLocale =
    normalizeTitleLocaleValue(artwork.titleLocale) ??
    resolveArtworkTitleValueLocale(artwork, fallbackLocale)
  const authoritativeTitle = getAuthoritativeArtworkTitle(
    artwork,
    fallbackLocale
  )
  const title = createAuthoritativeTitleRecord(authoritativeTitle)
  const titleSubtitle = createLocaleRecord((locale) => {
    const subtitle = artwork.titleSubtitle[locale]?.trim() || ""
    return locale === titleLocale || subtitle === authoritativeTitle
      ? ""
      : subtitle
  })

  return {
    ...artwork,
    titleLocale,
    title,
    titleSubtitle
  }
}
