import { z } from "zod"

export const supportedLocales = ["de", "en"] as const
export const translationStateValues = [
  "missing",
  "draft",
  "approved",
  "human"
] as const
export const audioStateValues = ["missing", "draft", "ready"] as const
export const analyticsProviderValues = [
  "none",
  "plausible",
  "goatcounter"
] as const

export type Locale = (typeof supportedLocales)[number]
export type TranslationState = (typeof translationStateValues)[number]
export type AudioState = (typeof audioStateValues)[number]
export type AnalyticsProvider = (typeof analyticsProviderValues)[number]

export const localeSchema = z.enum(supportedLocales)

export const localizedTextSchema = z.object({
  de: z.string().trim().default(""),
  en: z.string().trim().default("")
})

export const translationStateSchema = z.enum(translationStateValues)
export const audioStateSchema = z.enum(audioStateValues)

export const localizedTranslationStateSchema = z.object({
  de: translationStateSchema.default("human"),
  en: translationStateSchema.default("draft")
})

export const localizedAudioStateSchema = z.object({
  de: audioStateSchema.default("missing"),
  en: audioStateSchema.default("missing")
})

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: localizedTextSchema,
  caption: localizedTextSchema.optional(),
  kind: z.enum(["hero", "detail", "context"]).default("detail")
})

export const showSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  locales: z.array(localeSchema).min(2).default(["de", "en"]),
  defaultLocale: localeSchema.default("de"),
  title: localizedTextSchema,
  subtitle: localizedTextSchema,
  intro: localizedTextSchema,
  about: localizedTextSchema,
  help: localizedTextSchema,
  footer: localizedTextSchema,
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
  translationStatus: localizedTranslationStateSchema,
  audioGuideStyle: localizedTextSchema
})

export const artworkSchema = z.object({
  id: z.string().regex(/^\d{2}$/),
  number: z.number().int().positive(),
  slug: z.string().min(1),
  artist: z.string().trim().default(""),
  year: z.string().trim().default(""),
  title: localizedTextSchema,
  description: localizedTextSchema,
  material: localizedTextSchema,
  dimensions: z.string().trim().default(""),
  images: z.array(imageSchema).default([]),
  audioCues: localizedTextSchema.default({ de: "", en: "" }),
  audio: localizedTextSchema.default({ de: "", en: "" }),
  translationStatus: localizedTranslationStateSchema.default({
    de: "human",
    en: "draft"
  }),
  audioCueStatus: localizedAudioStateSchema.default({
    de: "missing",
    en: "missing"
  }),
  audioStatus: localizedAudioStateSchema.default({
    de: "missing",
    en: "missing"
  })
})

export const showBundleSchema = z.object({
  show: showSchema,
  artworks: z.array(artworkSchema)
})

export type LocalizedText = z.infer<typeof localizedTextSchema>
export type Show = z.infer<typeof showSchema>
export type Artwork = z.infer<typeof artworkSchema>
export type ShowBundle = z.infer<typeof showBundleSchema>

export function isApprovedState(value: TranslationState) {
  return value === "approved" || value === "human"
}
