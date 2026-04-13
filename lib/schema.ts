import { z } from "zod"

export const supportedLocales = ["de", "en", "es"] as const
export const artworkTitleLocaleValues = [...supportedLocales, "other"] as const
export const translationStateValues = [
  "missing",
  "draft",
  "approved",
  "human"
] as const
export const audioStateValues = ["missing", "draft", "ready"] as const
export const artworkGuideModeValues = ["guided", "signage-only"] as const
export const narrationProviderValues = [
  "none",
  "elevenlabs",
  "openai",
  "mock"
] as const
export const analyticsProviderValues = [
  "none",
  "plausible",
  "goatcounter"
] as const

export const localeMeta = {
  de: {
    label: "Deutsch",
    englishLabel: "German",
    autonym: "Deutsch"
  },
  en: {
    label: "English",
    englishLabel: "English",
    autonym: "English"
  },
  es: {
    label: "Español",
    englishLabel: "Spanish",
    autonym: "Español"
  }
} as const

export type Locale = (typeof supportedLocales)[number]
export type LocaleRecord<T> = Record<Locale, T>
export type ArtworkTitleLocale = (typeof artworkTitleLocaleValues)[number]
export type TranslationState = (typeof translationStateValues)[number]
export type AudioState = (typeof audioStateValues)[number]
export type ArtworkGuideMode = (typeof artworkGuideModeValues)[number]
export type NarrationProvider = (typeof narrationProviderValues)[number]
export type AnalyticsProvider = (typeof analyticsProviderValues)[number]

export const localeSchema = z.enum(supportedLocales)
export const artworkTitleLocaleSchema = z.enum(artworkTitleLocaleValues)
export const translationStateSchema = z.enum(translationStateValues)
export const audioStateSchema = z.enum(audioStateValues)
export const artworkGuideModeSchema = z.enum(artworkGuideModeValues)
export const narrationProviderSchema = z.enum(narrationProviderValues)

function buildLocaleRecordSchema<T extends z.ZodTypeAny>(factory: () => T) {
  const shape = Object.fromEntries(
    supportedLocales.map((locale) => [locale, factory()])
  ) as Record<Locale, T>

  return z.object(shape)
}

export function createLocaleRecord<T>(
  initializer: T | ((locale: Locale) => T)
): LocaleRecord<T> {
  return Object.fromEntries(
    supportedLocales.map((locale) => [
      locale,
      typeof initializer === "function"
        ? (initializer as (locale: Locale) => T)(locale)
        : initializer
    ])
  ) as LocaleRecord<T>
}

export const narrationRecordEntrySchema = z.object({
  baseText: z.string().trim().default(""),
  speechText: z.string().trim().default(""),
  cueTextUsed: z.string().trim().default(""),
  instructionsUsed: z.string().trim().default(""),
  provider: narrationProviderSchema.default("none"),
  model: z.string().trim().default(""),
  voiceId: z.string().trim().default(""),
  generatedAt: z.string().trim().default(""),
  outputPath: z.string().trim().default(""),
  seed: z.number().int().nonnegative().default(0)
})

export type NarrationRecordEntry = z.infer<typeof narrationRecordEntrySchema>

export function createEmptyNarrationRecordEntry(): NarrationRecordEntry {
  return {
    baseText: "",
    speechText: "",
    cueTextUsed: "",
    instructionsUsed: "",
    provider: "none",
    model: "",
    voiceId: "",
    generatedAt: "",
    outputPath: "",
    seed: 0
  }
}

export const localizedNarrationRecordSchema = buildLocaleRecordSchema(() =>
  narrationRecordEntrySchema.default(createEmptyNarrationRecordEntry())
)

function uniqueLocales(locales: readonly Locale[]) {
  return [...new Set(locales)] as Locale[]
}

export const localizedTextSchema = buildLocaleRecordSchema(() =>
  z.string().trim().default("")
)
export const localizedTranslationStateSchema = buildLocaleRecordSchema(() =>
  translationStateSchema.default("missing")
)
export const localizedAudioStateSchema = buildLocaleRecordSchema(() =>
  audioStateSchema.default("missing")
)

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: localizedTextSchema,
  caption: localizedTextSchema.optional(),
  kind: z.enum(["hero", "detail", "context"]).default("detail")
})

const rawShowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  locales: z.array(localeSchema).min(1).default(["de", "en"]),
  publicLocales: z.array(localeSchema).min(1).optional(),
  defaultLocale: localeSchema.default("de"),
  title: localizedTextSchema,
  subtitle: localizedTextSchema,
  intro: localizedTextSchema,
  about: localizedTextSchema,
  help: localizedTextSchema,
  footer: localizedTextSchema,
  researchNotes: localizedTextSchema.default(createLocaleRecord("")),
  organization: z.object({
    name: z.string().min(1),
    website: z.union([z.url(), z.literal("")]).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    instagram: z.string().optional().default("")
  }),
  branding: z.object({
    logoSrc: z.string().min(1),
    accent: z.string().min(1),
    accentSoft: z.string().min(1),
    paper: z.string().min(1),
    ink: z.string().min(1),
    qrLabelPrefix: z.string().default("promenade")
  }),
  analytics: z.object({
    provider: z.enum(analyticsProviderValues).default("none"),
    domain: z.string().default("")
  }),
  translationStatus: localizedTranslationStateSchema.default({
    ...createLocaleRecord("missing"),
    de: "human"
  }),
  audioGuideStyle: localizedTextSchema.default(createLocaleRecord(""))
})

export const showSchema = rawShowSchema.transform((show) => {
  const locales = uniqueLocales(show.locales)
  const defaultLocale = locales.includes(show.defaultLocale)
    ? show.defaultLocale
    : (locales[0] ?? "de")
  const requestedPublicLocales = uniqueLocales(
    (show.publicLocales?.length ? show.publicLocales : locales).filter(
      (locale) => locales.includes(locale)
    )
  )
  const publicLocales = requestedPublicLocales.length
    ? requestedPublicLocales
    : [defaultLocale]

  if (!publicLocales.includes(defaultLocale)) {
    publicLocales.unshift(defaultLocale)
  }

  return {
    ...show,
    locales,
    publicLocales,
    defaultLocale
  }
})

export const artworkSchema = z.object({
  id: z.string().regex(/^\d{2}$/),
  number: z.number().int().positive(),
  slug: z.string().min(1),
  guideMode: artworkGuideModeSchema.default("guided"),
  artist: z.string().trim().default(""),
  year: z.string().trim().default(""),
  sourceLocale: localeSchema.default("de"),
  titleLocale: artworkTitleLocaleSchema.default("de"),
  title: localizedTextSchema,
  titleSubtitle: localizedTextSchema.default(createLocaleRecord("")),
  sourceDescription: localizedTextSchema.default(createLocaleRecord("")),
  description: localizedTextSchema,
  material: localizedTextSchema,
  dimensions: z.string().trim().default(""),
  images: z.array(imageSchema).default([]),
  audioCues: localizedTextSchema.default(createLocaleRecord("")),
  audio: localizedTextSchema.default(createLocaleRecord("")),
  narrationRecord: localizedNarrationRecordSchema.default(
    createLocaleRecord(() => createEmptyNarrationRecordEntry())
  ),
  translationStatus: localizedTranslationStateSchema.default({
    ...createLocaleRecord("missing"),
    de: "human"
  }),
  audioCueStatus: localizedAudioStateSchema.default(
    createLocaleRecord("missing")
  ),
  audioStatus: localizedAudioStateSchema.default(createLocaleRecord("missing"))
})

export const showBundleSchema = z.object({
  show: showSchema,
  artworks: z.array(artworkSchema)
})

export type LocalizedText = z.infer<typeof localizedTextSchema>
export type Show = z.infer<typeof showSchema>
export type Artwork = z.infer<typeof artworkSchema>
export type ShowBundle = z.infer<typeof showBundleSchema>

export function getShowLocales(
  show: Pick<Show, "locales" | "defaultLocale">
): Locale[] {
  const locales = uniqueLocales(show.locales)

  if (!locales.includes(show.defaultLocale)) {
    locales.unshift(show.defaultLocale)
  }

  return locales
}

export function getShowPublicLocales(
  show: Pick<Show, "locales" | "publicLocales" | "defaultLocale">
): Locale[] {
  const locales = getShowLocales(show)
  const publicLocales = uniqueLocales(
    show.publicLocales.filter((locale) => locales.includes(locale))
  )

  if (!publicLocales.includes(show.defaultLocale)) {
    publicLocales.unshift(show.defaultLocale)
  }

  return publicLocales
}

export function isApprovedState(value: TranslationState) {
  return value === "approved" || value === "human"
}

export function isGuidedArtwork(artwork: Artwork) {
  return artwork.guideMode === "guided"
}
