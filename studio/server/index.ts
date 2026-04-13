import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  createEmptyArtwork,
  ensureShowDirectories,
  getActiveShowId,
  getArtworkFilePath,
  getShowDir,
  listShowSummariesSync,
  loadArtworksSync,
  loadShowBundleSync,
  loadShowSync,
  setActiveShowId,
  writeArtworkSync,
  writeShowSync
} from "@lib/content"
import { getServerEnv } from "@lib/env.server"
import { auditShowBundle } from "@lib/export"
import {
  getAuthoritativeArtworkTitle,
  getArtworkTitleParts,
  normalizeArtworkTitleFields
} from "@lib/artwork-title"
import { buildNarrationPlan, type NarrationPlan } from "@lib/audio-generation"
import { applyDerivedGenerationStatuses } from "@lib/generation-status"
import { buildGuideStationLookup, type GuideStation } from "@lib/guide-stations"
import { bestLocalizedValue } from "@lib/i18n"
import { buildGuideArtworkUrl, buildLocalePath } from "@lib/routing"
import {
  type Artwork,
  artworkSchema,
  getShowLocales,
  getShowPublicLocales,
  isGuidedArtwork,
  type Locale,
  localeMeta,
  type NarrationRecordEntry,
  showSchema,
  supportedLocales
} from "@lib/schema"
import { createShowBackup, importShowBackup } from "@lib/show-backup"
import { buildLightburnSignageCutSvg } from "@lib/signage-cut-svg"
import { buildEntranceSignPdf, buildSignagePdf } from "@lib/signage-pdf"
import type {
  DashboardPayload,
  EntranceSignPayload,
  PrintLayoutMode,
  PrintSheetItem,
  PrintSheetPayload,
  SignagePdfVariant
} from "@lib/studio"
import cors from "cors"
import express from "express"
import multer from "multer"
import QRCode from "qrcode"

const app = express()
const env = getServerEnv()
let showId = getActiveShowId()
const port = Number.parseInt(process.env.PORT ?? "8787", 10)
const studioBasePath = normalizeBasePath(env.STUDIO_BASE_PATH)

ensureShowDirectories(showId)

const backupImportDir = path.join(os.tmpdir(), "promenade-imports")
const backupUpload = multer({
  dest: backupImportDir
})
fs.mkdirSync(backupImportDir, { recursive: true })

const defaultElevenLabsVoiceIds: Record<Locale, string> = {
  de: "TUKJhQmz3RPYBNAgC5A1",
  en: "QngvLQR8bsLR5bzoa6Vv",
  es: "CFNUvNr80GexCH1pyfTY"
}

app.set("trust proxy", true)
app.use(cors())
app.use(express.json({ limit: "4mb" }))
app.use("/shows", express.static(path.resolve("public/shows")))
app.use("/icons", express.static(path.resolve("public/icons")))

const upload = multer({
  storage: multer.memoryStorage()
})

const batchJobConcurrency = 4

type AsyncRoute = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<void> | void

function asyncRoute(handler: AsyncRoute) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

function currentShowId() {
  return getActiveShowId()
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function normalizeBasePath(value: string) {
  const trimmed = value.trim()

  if (!trimmed || trimmed === "/") {
    return ""
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`
}

function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value
}

function createToneWavBuffer(seed: number) {
  const sampleRate = 22050
  const seconds = 2.6
  const samples = Math.floor(sampleRate * seconds)
  const dataSize = samples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  const frequency = 200 + seed * 21

  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8)
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate
    const envelope = Math.min(1, index / 4000) * (1 - index / samples)
    const sample =
      Math.sin(2 * Math.PI * frequency * time) * envelope * 0.28 +
      Math.sin(2 * Math.PI * (frequency * 1.5) * time) * envelope * 0.08

    buffer.writeInt16LE(
      Math.max(-1, Math.min(1, sample)) * 32767,
      44 + index * 2
    )
  }

  return buffer
}

function extractResponseText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") {
    return response.output_text
  }

  const output = Array.isArray(response.output) ? response.output : []

  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item)) {
      continue
    }

    const content = Array.isArray(item.content) ? item.content : []

    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue
      }

      if ("text" in block && typeof block.text === "string") {
        return block.text
      }
    }
  }

  throw new Error("OpenAI response did not include output text.")
}

function createDeterministicSeed(...values: string[]) {
  let hash = 2166136261

  for (const value of values) {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }

  return hash >>> 0
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  if (!items.length) {
    return
  }

  let nextIndex = 0
  let failure: Error | null = null
  const runnerCount = Math.max(1, Math.min(concurrency, items.length))

  async function runner() {
    while (failure === null) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      try {
        await worker(items[currentIndex], currentIndex)
      } catch (error) {
        failure = error as Error
        return
      }
    }
  }

  await Promise.all(Array.from({ length: runnerCount }, () => runner()))

  if (failure) {
    throw failure
  }
}

async function callOpenAiJson<T>({
  prompt,
  schema,
  payload
}: {
  prompt: string
  schema: Record<string, unknown>
  payload: Record<string, unknown>
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.")
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "promenade_payload",
          strict: true,
          schema
        }
      }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}.`)
  }

  const json = (await response.json()) as Record<string, unknown>
  return JSON.parse(extractResponseText(json)) as T
}

function hasLocalizedSourceCopy(artwork: Artwork, locale: Locale) {
  return Boolean(
    artwork.sourceDescription[locale].trim() ||
      artwork.description[locale].trim() ||
      artwork.material[locale].trim()
  )
}

function hasLocalizedSourceDescription(artwork: Artwork, locale: Locale) {
  return Boolean(artwork.sourceDescription[locale].trim())
}

function resolveArtworkSourceLocale(artwork: Artwork) {
  const show = loadShowSync(currentShowId())
  const locales = getShowLocales(show)
  const explicitSourceLocale = `${artwork.sourceLocale ?? ""}`.trim() as Locale

  if (locales.includes(explicitSourceLocale)) {
    return explicitSourceLocale
  }

  const sourceCandidates = [show.defaultLocale, ...locales]

  for (const locale of sourceCandidates) {
    if (hasLocalizedSourceDescription(artwork, locale)) {
      return locale
    }
  }

  const candidates = [
    show.defaultLocale,
    ...locales.filter(
      (locale) =>
        artwork.translationStatus[locale] === "human" ||
        artwork.translationStatus[locale] === "approved"
    ),
    ...locales
  ]

  for (const locale of candidates) {
    if (hasLocalizedSourceCopy(artwork, locale)) {
      return locale
    }
  }

  return show.defaultLocale
}

function resolveArtworkGuideSourceLocale(artwork: Artwork) {
  const sourceLocale = resolveArtworkSourceLocale(artwork)

  if (
    artwork.sourceDescription[sourceLocale].trim() ||
    artwork.description[sourceLocale].trim()
  ) {
    return sourceLocale
  }

  const show = loadShowSync(currentShowId())

  for (const locale of getShowLocales(show)) {
    if (artwork.description[locale].trim()) {
      return locale
    }
  }

  return show.defaultLocale
}

function resolveArtworkTranslationSource(artwork: Artwork) {
  const show = loadShowSync(currentShowId())
  const sourceLocale = resolveArtworkSourceLocale(artwork)
  const titleLocale = artwork.titleLocale
  const priority = [
    sourceLocale,
    show.defaultLocale,
    ...getShowLocales(show).filter(
      (locale) => locale !== sourceLocale && locale !== show.defaultLocale
    )
  ]
  const description =
    artwork.sourceDescription[sourceLocale].trim() ||
    artwork.description[sourceLocale].trim()

  if (!description) {
    throw new Error(
      `Translation requires source description text in ${localeMeta[sourceLocale].englishLabel}.`
    )
  }

  return {
    sourceLocale,
    titleLocale,
    title: getAuthoritativeArtworkTitle(artwork, show.defaultLocale),
    description,
    material: bestLocalizedValue(artwork.material, priority) || ""
  }
}

function buildPromptLocalePriority(
  show: ReturnType<typeof loadShowSync>,
  targetLocale: Locale,
  sourceLocale?: Locale
) {
  const priority = [targetLocale]

  if (sourceLocale) {
    priority.push(sourceLocale)
  }

  priority.push(show.defaultLocale)

  for (const locale of getShowLocales(show)) {
    if (!priority.includes(locale)) {
      priority.push(locale)
    }
  }

  return priority
}

function buildShowPromptContext(
  show: ReturnType<typeof loadShowSync>,
  targetLocale: Locale,
  sourceLocale?: Locale
) {
  const priority = buildPromptLocalePriority(show, targetLocale, sourceLocale)
  const title = bestLocalizedValue(show.title, priority)
  const subtitle = bestLocalizedValue(show.subtitle, priority)
  const intro = bestLocalizedValue(show.intro, priority)
  const about = bestLocalizedValue(show.about, priority)
  const researchNotes = bestLocalizedValue(show.researchNotes, priority)
  const sections = [
    title ? `Exhibition title: ${title}` : "",
    subtitle ? `Exhibition subtitle: ${subtitle}` : "",
    show.organization.name ? `Institution: ${show.organization.name}` : "",
    intro ? `Visitor intro: ${intro}` : "",
    about ? `About / curatorial frame: ${about}` : "",
    researchNotes ? `Internal research notes:\n${researchNotes}` : ""
  ].filter(Boolean)

  if (!sections.length) {
    return ""
  }

  return `Exhibition context:\n${sections.join("\n\n")}`
}

async function generateTranslationDraft(
  artwork: Artwork,
  source: ReturnType<typeof resolveArtworkTranslationSource>,
  targetLocale: Locale
) {
  const { description, material, sourceLocale, title, titleLocale } = source

  if (!env.OPENAI_API_KEY) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error("Translation requires OPENAI_API_KEY.")
    }

    return {
      titleSubtitle: artwork.titleSubtitle[targetLocale] || "",
      description:
        artwork.description[targetLocale] ||
        `Draft translation: ${description}`,
      material:
        artwork.material[targetLocale] || `Draft translation: ${material}`
    }
  }

  return callOpenAiJson<{
    titleSubtitle: string
    description: string
    material: string
  }>({
    prompt: `You are translating authoritative artwork copy for a museum audio guide. Translate ${
      localeMeta[sourceLocale].englishLabel
    } source text into ${localeMeta[targetLocale].englishLabel}.

Quality rules:
- Every returned field must be written fully in ${localeMeta[targetLocale].englishLabel}.
- Do not leave source-language sentences untranslated.
- Do not mix source and target languages except for quoted artwork titles, established proper nouns, or source-language terms that clearly must stay as-is.
- Preserve meaning, structure, voice, and completeness as closely as possible.
- Keep the translated description close to the original in sentence order, rhetorical shape, and informational density.
- Be faithful rather than adaptive. Do not summarize, simplify away nuance, or rewrite for drama.
- Keep first-person passages, quotations, questions, and culturally specific references intact unless grammar in the target language requires light adjustment.
- Do not add interpretation, atmosphere, curatorial uplift, or generic audio-guide wording.
- Do not omit factual details.
- Do not introduce year, medium, dimensions, awards, exhibition framing, or artist biography unless the source text already contains them.
- Translate for clear spoken-language comprehension in a museum audio-guide context, but not for stylistic reinvention.
- The artwork title is authoritative and must stay unchanged in the app.
- Return the field "titleSubtitle" only as an optional helper translation for the title.
- If the original title already works unchanged in ${localeMeta[targetLocale].englishLabel}, or if translating it would be misleading, return an empty string for "titleSubtitle".
- Keep title subtitles concise and faithful.`,
    schema: {
      type: "object",
      properties: {
        titleSubtitle: { type: "string" },
        description: { type: "string" },
        material: { type: "string" }
      },
      additionalProperties: false,
      required: ["titleSubtitle", "description", "material"]
    },
    payload: {
      sourceLocale,
      targetLocale,
      title,
      titleLocale,
      description,
      material,
      artist: artwork.artist,
      year: artwork.year
    }
  })
}

async function generateTitleSubtitleDraft(
  artwork: Artwork,
  source: ReturnType<typeof resolveArtworkTranslationSource>,
  targetLocale: Locale
) {
  const { description, sourceLocale, title, titleLocale } = source

  if (targetLocale === titleLocale) {
    return ""
  }

  if (!env.OPENAI_API_KEY) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error("Translation requires OPENAI_API_KEY.")
    }

    return artwork.titleSubtitle[targetLocale] || ""
  }

  const result = await callOpenAiJson<{ titleSubtitle: string }>({
    prompt: `You are preparing a faithful helper subtitle for an artwork title in a museum audio guide.

Rules:
- The original artwork title remains authoritative and unchanged.
- Return a concise subtitle translation in ${localeMeta[targetLocale].englishLabel} only if it genuinely helps visitor understanding.
- If the original title already works unchanged, is a proper name, or should remain untranslated, return an empty string.
- Do not add interpretation, explanation, or curatorial language.
- Stay as close as possible to the meaning of the original title.`,
    schema: {
      type: "object",
      properties: {
        titleSubtitle: { type: "string" }
      },
      additionalProperties: false,
      required: ["titleSubtitle"]
    },
    payload: {
      artist: artwork.artist,
      sourceLocale,
      targetLocale,
      title,
      titleLocale,
      description
    }
  })

  return result.titleSubtitle
}

async function generateArtworkTranslations(
  artwork: Artwork,
  targetLocales?: Locale[]
) {
  const show = loadShowSync(currentShowId())
  const source = resolveArtworkTranslationSource(artwork)
  const { sourceLocale } = source
  const requestedTargets = (
    targetLocales?.length ? targetLocales : getShowLocales(show)
  ).filter((locale) => getShowLocales(show).includes(locale))
  let nextArtwork = structuredClone(artwork)

  if (requestedTargets.includes(sourceLocale)) {
    const sourceTitleSubtitle =
      sourceLocale === source.titleLocale
        ? ""
        : await generateTitleSubtitleDraft(nextArtwork, source, sourceLocale)

    nextArtwork = normalizeArtworkForWrite(nextArtwork, {
      ...nextArtwork,
      description: {
        ...nextArtwork.description,
        [sourceLocale]: source.description
      },
      titleSubtitle: {
        ...nextArtwork.titleSubtitle,
        [sourceLocale]: sourceTitleSubtitle
      },
      translationStatus: {
        ...nextArtwork.translationStatus,
        [sourceLocale]: "human"
      }
    })
  }

  for (const targetLocale of requestedTargets.filter(
    (locale) => locale !== sourceLocale
  )) {
    const draft = await generateTranslationDraft(
      nextArtwork,
      source,
      targetLocale
    )

    nextArtwork = normalizeArtworkForWrite(nextArtwork, {
      ...nextArtwork,
      titleSubtitle: {
        ...nextArtwork.titleSubtitle,
        [targetLocale]: draft.titleSubtitle
      },
      description: {
        ...nextArtwork.description,
        [targetLocale]: draft.description
      },
      material: {
        ...nextArtwork.material,
        [targetLocale]: draft.material
      },
      audioCues: {
        ...nextArtwork.audioCues,
        [targetLocale]: ""
      },
      translationStatus: {
        ...nextArtwork.translationStatus,
        [targetLocale]: "draft"
      }
    })
  }

  return nextArtwork
}

function buildMockCueText(artwork: Artwork, locale: Locale) {
  if (locale === "de") {
    return [
      "Atmosphäre: warm, aufmerksam, leicht staunend.",
      "Tempo: ruhig beginnen, dann bei der Bildbewegung etwas anziehen.",
      `Bildfokus: ${
        getAuthoritativeArtworkTitle(artwork, locale) || artwork.id
      } mit einer klaren visuellen Beobachtung verankern.`,
      "Pausen und Aussprache: nach dem Werktitel kurz atmen und Materialbegriffe deutlich setzen."
    ].join("\n")
  }

  if (locale === "es") {
    return [
      "Atmósfera: cálida, observadora y levemente asombrada.",
      "Ritmo: empezar con calma y ganar un poco de impulso cuando aparezca el movimiento visual.",
      `Foco visual: anclar la narración en ${
        getAuthoritativeArtworkTitle(artwork, locale) || artwork.id
      } con una observación concreta.`,
      "Pausas y énfasis: dejar una breve pausa después del título y articular con claridad los materiales."
    ].join("\n")
  }

  return [
    "Atmosphere: warm, observant, gently vivid.",
    "Pacing: begin calmly, then add a touch of lift when the visual movement appears.",
    `Visual focus: anchor the narration in ${
      getAuthoritativeArtworkTitle(artwork, locale) || artwork.id
    } with one concrete visual observation.`,
    "Pauses and pronunciation: leave a small pause after the title and articulate material terms cleanly."
  ].join("\n")
}

function getCueGenerationPrompt(
  styleGuide: string,
  promptContext: string,
  locale: Locale
) {
  const contextBlock = promptContext ? `${promptContext}\n\n` : ""

  if (locale === "de") {
    return `${styleGuide}

${contextBlock}

Du schreibst Regieanweisungen fuer einen ruhigen, konsistenten Museums-Audioguide auf Deutsch.
Ziel: Die spaetere Stimme soll klar, aufmerksam und bildnah klingen, ohne starke Dramatisierung.
Die Hinweise duerfen den Text nur leicht formen. Vermeide austauschbare Museumsphrasen und theatrale Zuspitzung.

Schreibe genau vier Zeilen und beginne jede Zeile mit einem dieser Labels:
Atmosphaere:
Tempo:
Bildfokus:
Pausen/Betonung:

Qualitaetsregeln:
- Nutze nur Informationen aus dem gelieferten Material; erfinde nichts.
- Atmosphaere soll Licht, Dichte oder Grundstimmung knapp benennen, ohne Pathos.
- Tempo soll vor allem Gleichmass und Stellen fuer kleine Verlangsamungen benennen.
- Bildfokus muss ein sichtbares Detail, eine Formbeziehung oder eine Blickbewegung nennen.
- Gib nur dann Aussprachehinweise ein, wenn Namen wirklich erklaerungsbeduerftig sind; sonst gib eine konkrete Pause- oder Betonungsanweisung.
- Vermeide Formeln wie "interessant", "faszinierend", "Meisterwerk", "ikonisch" oder "Dieses Werk zeigt".
- Wiederhole keine ganzen Saetze aus der Beschreibung.`
  }

  if (locale === "es") {
    return `${styleGuide}

${contextBlock}

Escribes notas breves de dirección para una audioguía de museo serena y consistente en español.
Objetivo: que la voz final suene clara, atenta y cercana a la imagen, sin dramatización fuerte.
Las indicaciones solo deben modular el texto ligeramente. Evita el lenguaje museístico genérico y cualquier tono teatral.

Escribe exactamente cuatro líneas y empieza cada una con una de estas etiquetas:
Atmósfera:
Ritmo:
Foco visual:
Pausas/énfasis:

Reglas de calidad:
- Usa solo la información suministrada; no inventes nada.
- Atmósfera debe nombrar de forma sobria la luz, la densidad o el clima general.
- Ritmo debe centrarse en una cadencia estable y en posibles pequeñas ralentizaciones.
- Foco visual debe nombrar un detalle visible, una relación formal o un recorrido de la mirada.
- Añade ayuda de pronunciación solo si un nombre realmente lo requiere; si no, usa la línea para pausas o énfasis.
- Evita fórmulas como "interesante", "fascinante", "obra maestra", "icónico" o "esta obra muestra".
- No repitas frases completas de la descripción.`
  }

  return `${styleGuide}

${contextBlock}

You write brief direction notes for a calm, consistent museum audio guide in English.
Goal: the final voice should feel clear, attentive, and image-led without becoming dramatic.
The notes should only shape the copy lightly. Avoid reusable museum boilerplate and theatrical delivery.

Write exactly four lines and start each line with one of these labels:
Atmosphere:
Pacing:
Visual focus:
Pauses/emphasis:

Quality rules:
- Use only the supplied facts; do not invent context.
- Atmosphere should name light, density, or overall mood in a restrained way.
- Pacing should focus on steadiness plus any brief places to slow down.
- Visual focus must name a visible detail, shape relationship, or movement of the eye.
- Give pronunciation help only when a name is genuinely non-obvious; otherwise use the line for pause or emphasis guidance.
- Avoid words like "iconic", "captivating", "interesting", "masterpiece", or formulas like "this painting shows" and "we can see".
- Do not repeat full sentences from the description.`
}

function normalizeArtworkForWrite(existing: Artwork | null, artwork: Artwork) {
  const show = loadShowSync(currentShowId())
  const locales = getShowLocales(show)
  const normalizedArtwork = artworkSchema.parse(
    normalizeArtworkTitleFields(
      {
        ...artwork,
        slug:
          artwork.slug ||
          slugify(
            getAuthoritativeArtworkTitle(artwork, show.defaultLocale) ||
              artwork.artist ||
              artwork.id
          )
      },
      show.defaultLocale
    )
  )

  for (const locale of locales) {
    if (
      hasLocalizedSourceCopy(normalizedArtwork, locale) &&
      normalizedArtwork.translationStatus[locale] === "missing"
    ) {
      normalizedArtwork.translationStatus[locale] = "human"
    }
  }

  if (!existing) {
    return normalizedArtwork
  }

  return artworkSchema.parse(
    applyDerivedGenerationStatuses(existing, normalizedArtwork, locales)
  )
}

function getConfiguredElevenLabsVoiceId(locale: Locale) {
  if (env.ELEVENLABS_VOICE_IDS) {
    try {
      const parsed = JSON.parse(env.ELEVENLABS_VOICE_IDS) as Partial<
        Record<Locale, string>
      >
      const configured = parsed[locale]?.trim()

      if (configured) {
        return configured
      }
    } catch {
      throw new Error("ELEVENLABS_VOICE_IDS must be valid JSON.")
    }
  }

  const legacyMap: Record<Locale, string | undefined> = {
    de: env.ELEVENLABS_DE_VOICE_ID,
    en: env.ELEVENLABS_EN_VOICE_ID,
    es: env.ELEVENLABS_ES_VOICE_ID
  }

  return legacyMap[locale]?.trim() || defaultElevenLabsVoiceIds[locale]
}

async function generateArtworkCueText(artwork: Artwork, locale: Locale) {
  const show = loadShowSync(currentShowId())
  const description = artwork.description[locale].trim()

  if (!description) {
    throw new Error(
      `Cue generation requires guide description text in ${localeMeta[locale].englishLabel}.`
    )
  }

  const promptContext = buildShowPromptContext(
    show,
    locale,
    resolveArtworkGuideSourceLocale(artwork)
  )

  if (!env.OPENAI_API_KEY) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error("Cue generation requires OPENAI_API_KEY.")
    }

    return buildMockCueText(artwork, locale)
  }

  const result = await callOpenAiJson<{ cueText: string }>({
    prompt: getCueGenerationPrompt(
      show.audioGuideStyle[locale],
      promptContext,
      locale
    ),
    schema: {
      type: "object",
      properties: {
        cueText: { type: "string" }
      },
      additionalProperties: false,
      required: ["cueText"]
    },
    payload: {
      locale,
      artist: artwork.artist,
      title: getAuthoritativeArtworkTitle(artwork, locale),
      year: artwork.year,
      material: artwork.material[locale],
      description
    }
  })

  return result.cueText.trim()
}

async function synthesizeWithElevenLabs(
  locale: Locale,
  text: string,
  seed: number
) {
  const apiKey = env.ELEVENLABS_API_KEY
  const voiceId = getConfiguredElevenLabsVoiceId(locale)

  if (!apiKey || !voiceId) {
    return null
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        language_code: locale,
        seed,
        voice_settings: {
          stability: 0.78,
          similarity_boost: 0.78,
          style: 0.05,
          use_speaker_boost: true
        }
      })
    }
  )

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim()
    throw new Error(
      `ElevenLabs request failed with ${response.status}.${detail ? ` ${detail.slice(0, 280)}` : ""}`
    )
  }

  return {
    provider: "elevenlabs" as const,
    model: "eleven_multilingual_v2",
    voiceId,
    seed,
    extension: "mp3",
    buffer: Buffer.from(await response.arrayBuffer())
  }
}

async function synthesizeWithOpenAi(
  locale: Locale,
  text: string,
  instructions: string
) {
  if (!env.OPENAI_API_KEY) {
    return null
  }

  const voice = locale === "de" ? "sage" : locale === "es" ? "alloy" : "marin"
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      input: text,
      voice,
      instructions,
      response_format: "mp3"
    })
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim()
    throw new Error(
      `OpenAI TTS request failed with ${response.status}.${detail ? ` ${detail.slice(0, 280)}` : ""}`
    )
  }

  return {
    provider: "openai" as const,
    model: "gpt-4o-mini-tts",
    voiceId: voice,
    seed: 0,
    extension: "mp3",
    buffer: Buffer.from(await response.arrayBuffer())
  }
}

function buildNarrationRecord(
  plan: NarrationPlan,
  audioPath: string,
  output: {
    provider: "elevenlabs" | "openai" | "mock"
    model: string
    voiceId: string
    seed: number
  }
): NarrationRecordEntry {
  return {
    baseText: plan.baseText,
    speechText: plan.speechText,
    cueTextUsed: plan.cueTextUsed,
    instructionsUsed: plan.instructionsUsed,
    provider: output.provider,
    model: output.model,
    voiceId: output.voiceId,
    generatedAt: new Date().toISOString(),
    outputPath: audioPath,
    seed: output.seed
  }
}

type GeneratedAudioOutput = {
  provider: "elevenlabs" | "openai" | "mock"
  model: string
  voiceId: string
  seed: number
  extension: string
  buffer: Buffer
}

async function generateArtworkAudio(artwork: Artwork, locale: Locale) {
  const show = loadShowSync(currentShowId())
  const plan = buildNarrationPlan(show, artwork, locale)
  return generateArtworkAudioWithOptions(
    artwork,
    locale,
    { useCues: false },
    plan
  )
}

async function generateArtworkAudioWithOptions(
  artwork: Artwork,
  locale: Locale,
  _options: { useCues?: boolean } = {},
  prebuiltPlan?: NarrationPlan
) {
  const show = loadShowSync(currentShowId())
  const plan = prebuiltPlan ?? buildNarrationPlan(show, artwork, locale)
  const showId = currentShowId()
  const audioRoot = path.resolve("public", "shows", showId, "media", "audio")
  fs.mkdirSync(audioRoot, { recursive: true })
  const seed = createDeterministicSeed(
    showId,
    artwork.id,
    locale,
    plan.speechText
  )

  let output: GeneratedAudioOutput | null = null

  try {
    output = await synthesizeWithElevenLabs(locale, plan.speechText, seed)
  } catch (error) {
    console.warn(
      `[audio] ElevenLabs failed for artwork ${artwork.id} ${locale}: ${(error as Error).message}`
    )
  }

  if (!output) {
    try {
      output = await synthesizeWithOpenAi(
        locale,
        plan.speechText,
        plan.instructionsUsed
      )
    } catch (error) {
      console.warn(
        `[audio] OpenAI TTS failed for artwork ${artwork.id} ${locale}: ${(error as Error).message}`
      )
    }
  }

  if (!output) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error(
        "Audio generation requires ElevenLabs or OpenAI credentials."
      )
    }

    output = {
      provider: "mock" as const,
      model: "mock-tone",
      voiceId: "mock",
      seed,
      extension: "wav",
      buffer: createToneWavBuffer(
        artwork.number + (locale === "de" ? 1 : locale === "es" ? 17 : 9)
      )
    }
  }

  const fileName = `${artwork.id}-${locale}.${output.extension}`
  for (const extension of ["mp3", "wav"]) {
    const existingPath = path.join(
      audioRoot,
      `${artwork.id}-${locale}.${extension}`
    )
    if (fs.existsSync(existingPath)) {
      fs.rmSync(existingPath, { force: true })
    }
  }
  fs.writeFileSync(path.join(audioRoot, fileName), output.buffer)

  const audioPath = `/shows/${showId}/media/audio/${fileName}`

  return {
    audioPath,
    narrationRecord: buildNarrationRecord(plan, audioPath, output)
  }
}

async function buildQrItem(
  req: express.Request,
  artwork: Artwork,
  locale: Locale,
  guideStations: Map<string, GuideStation>
): Promise<PrintSheetItem> {
  const showId = currentShowId()
  const show = loadShowSync(showId)
  const studioBaseUrl = getStudioBaseUrl(req)
  const guided = isGuidedArtwork(artwork)
  const guideStation = guideStations.get(artwork.id) ?? null
  const url = guided
    ? buildGuideArtworkUrl(
        locale,
        guideStation?.stationId ?? artwork.id,
        env.PUBLIC_SITE_URL
      )
    : ""
  const svg = guided
    ? await QRCode.toString(url, {
        margin: 1,
        type: "svg",
        width: 320,
        color: {
          dark: show.branding.ink,
          light: "#ffffff"
        }
      })
    : ""

  if (guided) {
    const qrDir = path.join(getShowDir(showId), "generated", "qrs", locale)
    const filePath = path.join(qrDir, `${artwork.id}.svg`)

    fs.mkdirSync(qrDir, { recursive: true })
    fs.writeFileSync(filePath, svg)
  }

  const parsedUrl = guided ? new URL(url) : null

  return {
    id: artwork.id,
    guideNumber: guideStation?.stationId ?? "",
    number: artwork.number,
    guideMode: artwork.guideMode,
    artist: artwork.artist,
    title: getArtworkTitleParts(artwork, locale).title,
    titleSubtitle: getArtworkTitleParts(artwork, locale).subtitle,
    showTitle: bestLocalizedValue(
      show.title,
      buildPromptLocalePriority(show, locale)
    ),
    year: artwork.year,
    material: artwork.material[locale],
    dimensions: artwork.dimensions,
    organizationName: show.organization.name,
    locale,
    logoSrc: `${studioBaseUrl}${show.branding.logoSrc}`,
    url,
    humanUrl: parsedUrl ? `${parsedUrl.host}${parsedUrl.pathname}` : "",
    svg,
    downloadUrl: guided
      ? `${studioBaseUrl}/api/artworks/${artwork.id}/qr?locale=${locale}&download=1`
      : "",
    accent: show.branding.accent,
    accentSoft: show.branding.accentSoft,
    paper: show.branding.paper,
    ink: show.branding.ink
  }
}

async function buildEntranceSignPayload(
  req: express.Request,
  locale: Locale
): Promise<EntranceSignPayload> {
  const showId = currentShowId()
  const show = loadShowSync(showId)
  const studioBaseUrl = getStudioBaseUrl(req)
  const url = new URL(buildLocalePath(locale), env.PUBLIC_SITE_URL).toString()
  const parsedUrl = new URL(url)
  const svg = await QRCode.toString(url, {
    margin: 1,
    type: "svg",
    width: 960,
    color: {
      dark: show.branding.ink,
      light: "#ffffff"
    }
  })

  return {
    locale,
    organizationName: show.organization.name,
    showTitle: bestLocalizedValue(show.title, [locale, show.defaultLocale]),
    showSubtitle: bestLocalizedValue(show.subtitle, [
      locale,
      show.defaultLocale
    ]),
    logoSrc: `${studioBaseUrl}${show.branding.logoSrc}`,
    publicLocales: getShowPublicLocales(show),
    url,
    humanUrl: `${parsedUrl.host}${parsedUrl.pathname}`,
    svg,
    accent: show.branding.accent,
    accentSoft: show.branding.accentSoft,
    paper: show.branding.paper,
    ink: show.branding.ink
  }
}

function getRequestOrigin(req: express.Request) {
  const forwardedProto = `${req.headers["x-forwarded-proto"] ?? req.protocol}`
    .split(",")[0]
    .trim()
  const forwardedHost =
    `${req.headers["x-forwarded-host"] ?? req.get("host") ?? ""}`
      .split(",")[0]
      .trim()

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(env.STUDIO_API_ORIGIN).origin
}

function getStudioBaseUrl(req?: express.Request) {
  if (!req) {
    return stripTrailingSlash(env.STUDIO_API_ORIGIN)
  }

  return `${getRequestOrigin(req)}${studioBasePath}`
}

function resolveRequestedLocales(
  show: ReturnType<typeof loadShowSync>,
  requested: unknown,
  scope: "all" | "public" = "all"
) {
  const available =
    scope === "public" ? getShowPublicLocales(show) : getShowLocales(show)

  if (requested === "all" || requested === "both") {
    return available
  }

  const normalized = `${requested ?? ""}`.trim() as Locale

  return available.includes(normalized) ? [normalized] : [available[0]]
}

function createDashboardPayload(req?: express.Request): DashboardPayload {
  const showId = currentShowId()
  const bundle = loadShowBundleSync(showId)
  const audit = auditShowBundle(bundle)
  const studioOrigin = getStudioBaseUrl(req)

  return {
    bundle,
    audit,
    showId,
    shows: listShowSummariesSync(),
    siteUrl: env.PUBLIC_SITE_URL,
    studioOrigin
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.get("/api/bundle", (req, res) => {
  res.json(createDashboardPayload(req))
})

app.post(
  "/api/show/logo",
  upload.single("file"),
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const file = req.file

    if (!file) {
      res.status(400).json({ message: "Logo upload requires a file." })
      return
    }

    const originalExtension = path
      .extname(file.originalname || "")
      .toLowerCase()
    const extension =
      originalExtension === ".jpeg" ? ".jpg" : originalExtension || ".png"

    if (![".png", ".jpg"].includes(extension)) {
      res.status(400).json({
        message:
          "Show logos must be uploaded as PNG or JPG for print-safe exports."
      })
      return
    }

    const brandRoot = path.resolve("public", "shows", showId, "brand")
    const fileName = `logo${extension}`

    fs.mkdirSync(brandRoot, { recursive: true })
    fs.writeFileSync(path.join(brandRoot, fileName), file.buffer)
    show.branding.logoSrc = `/shows/${showId}/brand/${fileName}`
    writeShowSync(showId, show)

    res.json(createDashboardPayload(req))
  })
)

app.put(
  "/api/show",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const nextShow = showSchema.parse(req.body)
    writeShowSync(showId, nextShow)
    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const artwork = createEmptyArtwork(showId)
    writeArtworkSync(showId, artwork)
    res.status(201).json(createDashboardPayload(req))
  })
)

app.put(
  "/api/artworks/:id",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const existing = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!existing) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    const current = artworkSchema.parse(req.body)
    const normalizedArtwork = normalizeArtworkForWrite(existing, current)

    if (normalizedArtwork.id !== req.params.id) {
      throw new Error("Artwork id mismatch.")
    }

    writeArtworkSync(showId, normalizedArtwork)
    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/:id/images",
  upload.array("files"),
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const artworkId = `${req.params.id}`
    const artworkFile = getArtworkFilePath(showId, artworkId)
    const artwork = artworkSchema.parse(
      JSON.parse(fs.readFileSync(artworkFile, "utf8"))
    )
    const files = Array.isArray(req.files) ? req.files : []
    const imageRoot = path.resolve("public", "shows", showId, "media", "images")

    fs.mkdirSync(imageRoot, { recursive: true })

    for (const [index, file] of files.entries()) {
      const extension = path.extname(file.originalname || ".png") || ".png"
      const fileName = `${artwork.id}-${Date.now()}-${index}${extension}`

      fs.writeFileSync(path.join(imageRoot, fileName), file.buffer)
      artwork.images.push({
        src: `/shows/${showId}/media/images/${fileName}`,
        alt: {
          de: `${getAuthoritativeArtworkTitle(artwork, "de") || artwork.artist} – Upload ${artwork.images.length + 1}`,
          en: `${getAuthoritativeArtworkTitle(artwork, "en") || artwork.artist} – Upload ${artwork.images.length + 1}`,
          es: `${getAuthoritativeArtworkTitle(artwork, "es") || artwork.artist} – Upload ${artwork.images.length + 1}`
        },
        kind: artwork.images.length ? "detail" : "hero"
      })
    }

    writeArtworkSync(showId, artwork)
    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/batch/translate",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const requestedLocales = Array.isArray(req.body?.targetLocales)
      ? req.body.targetLocales
      : typeof req.body?.locale === "string"
        ? [req.body.locale]
        : []
    const targetLocales = requestedLocales
      .map((value: unknown) => `${value}`.trim())
      .filter((value: string): value is Locale =>
        getShowLocales(show).includes(value as Locale)
      )
    const artworks = loadArtworksSync(showId).filter(isGuidedArtwork)

    try {
      await runWithConcurrency(
        artworks,
        batchJobConcurrency,
        async (artwork, index) => {
          console.info(
            `[translate] ${index + 1}/${artworks.length} ${artwork.id} started`
          )
          const nextArtwork = await generateArtworkTranslations(
            artwork,
            targetLocales.length ? targetLocales : undefined
          )
          writeArtworkSync(showId, nextArtwork)
          console.info(
            `[translate] ${index + 1}/${artworks.length} ${artwork.id} finished`
          )
        }
      )
    } catch (error) {
      res.status(409).json({
        message: `Batch translation stopped: ${(error as Error).message}`
      })
      return
    }

    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/batch/audio-cues",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = (req.body?.locale ?? "all") as Locale | "all" | "both"
    const targetLocales = resolveRequestedLocales(show, locale, "public")
    const artworks = loadArtworksSync(showId).filter(isGuidedArtwork)

    try {
      await runWithConcurrency(
        artworks,
        batchJobConcurrency,
        async (artwork, index) => {
          console.info(
            `[audio-cues] ${index + 1}/${artworks.length} ${artwork.id} started`
          )
          let nextArtwork = structuredClone(artwork)

          for (const currentLocale of targetLocales) {
            if (!nextArtwork.description[currentLocale].trim()) {
              throw new Error(
                `Artwork ${artwork.id} is missing guide description text in ${localeMeta[currentLocale].englishLabel}.`
              )
            }

            const cueText = await generateArtworkCueText(
              nextArtwork,
              currentLocale
            )
            nextArtwork = normalizeArtworkForWrite(nextArtwork, {
              ...nextArtwork,
              audioCues: {
                ...nextArtwork.audioCues,
                [currentLocale]: cueText
              }
            })
          }

          writeArtworkSync(showId, nextArtwork)
          console.info(
            `[audio-cues] ${index + 1}/${artworks.length} ${artwork.id} finished`
          )
        }
      )
    } catch (error) {
      res.status(409).json({
        message: `Batch cue generation stopped: ${(error as Error).message}`
      })
      return
    }

    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/batch/audio",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = (req.body?.locale ?? "all") as Locale | "all" | "both"
    const useCues = req.body?.useCues === true
    const targetLocales = resolveRequestedLocales(show, locale, "public")
    const artworks = loadArtworksSync(showId).filter(isGuidedArtwork)

    try {
      await runWithConcurrency(
        artworks,
        batchJobConcurrency,
        async (artwork, index) => {
          console.info(
            `[audio] ${index + 1}/${artworks.length} ${artwork.id} started`
          )
          let nextArtwork = structuredClone(artwork)

          for (const currentLocale of targetLocales) {
            if (!nextArtwork.description[currentLocale].trim()) {
              throw new Error(
                `Artwork ${artwork.id} is missing guide description text in ${localeMeta[currentLocale].englishLabel}.`
              )
            }

            const { audioPath, narrationRecord } =
              await generateArtworkAudioWithOptions(
                nextArtwork,
                currentLocale,
                {
                  useCues
                }
              )
            nextArtwork.audio = {
              ...nextArtwork.audio,
              [currentLocale]: audioPath
            }
            nextArtwork.narrationRecord = {
              ...nextArtwork.narrationRecord,
              [currentLocale]: narrationRecord
            }
            nextArtwork.audioStatus = {
              ...nextArtwork.audioStatus,
              [currentLocale]: "ready"
            }
          }

          writeArtworkSync(showId, nextArtwork)
          console.info(
            `[audio] ${index + 1}/${artworks.length} ${artwork.id} finished`
          )
        }
      )
    } catch (error) {
      res.status(409).json({
        message: `Batch audio generation stopped: ${(error as Error).message}`
      })
      return
    }

    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/:id/translate",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    const requestedLocales = Array.isArray(req.body?.targetLocales)
      ? req.body.targetLocales
      : typeof req.body?.locale === "string"
        ? [req.body.locale]
        : []
    const targetLocales = requestedLocales
      .map((value: unknown) => `${value}`.trim())
      .filter((value: string): value is Locale =>
        getShowLocales(show).includes(value as Locale)
      )
    const nextArtwork = await generateArtworkTranslations(
      artwork,
      targetLocales.length ? targetLocales : undefined
    )

    writeArtworkSync(showId, nextArtwork)

    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/:id/audio-cues",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = (req.body?.locale ?? "all") as Locale | "all" | "both"
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    if (!isGuidedArtwork(artwork)) {
      res.status(409).json({
        message:
          "Signage-only artworks do not generate audio cues because they are excluded from the visitor guide."
      })
      return
    }

    const targetLocales = resolveRequestedLocales(show, locale, "public")
    let nextArtwork = structuredClone(artwork)

    for (const currentLocale of targetLocales) {
      if (!nextArtwork.description[currentLocale].trim()) {
        res.status(409).json({
          message: `Cue generation requires guide description text in ${localeMeta[currentLocale].englishLabel}.`
        })
        return
      }

      const cueText = await generateArtworkCueText(nextArtwork, currentLocale)
      nextArtwork = normalizeArtworkForWrite(nextArtwork, {
        ...nextArtwork,
        audioCues: {
          ...nextArtwork.audioCues,
          [currentLocale]: cueText
        }
      })
    }

    writeArtworkSync(showId, nextArtwork)

    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/:id/audio",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = (req.body?.locale ?? "all") as Locale | "all" | "both"
    const useCues = req.body?.useCues === true
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    if (!isGuidedArtwork(artwork)) {
      res.status(409).json({
        message:
          "Signage-only artworks do not generate audio because they are excluded from the visitor guide."
      })
      return
    }

    const targetLocales = resolveRequestedLocales(show, locale, "public")
    let nextArtwork = structuredClone(artwork)

    for (const currentLocale of targetLocales) {
      if (!nextArtwork.description[currentLocale].trim()) {
        res.status(409).json({
          message: `Audio generation requires guide description text in ${localeMeta[currentLocale].englishLabel}.`
        })
        return
      }

      const { audioPath, narrationRecord } =
        await generateArtworkAudioWithOptions(nextArtwork, currentLocale, {
          useCues
        })
      nextArtwork.audio = {
        ...nextArtwork.audio,
        [currentLocale]: audioPath
      }
      nextArtwork.narrationRecord = {
        ...nextArtwork.narrationRecord,
        [currentLocale]: narrationRecord
      }
      nextArtwork.audioStatus = {
        ...nextArtwork.audioStatus,
        [currentLocale]: "ready"
      }
    }

    writeArtworkSync(showId, nextArtwork)
    res.json(createDashboardPayload(req))
  })
)

app.get(
  "/api/artworks/:id/qr",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const artworks = loadArtworksSync(showId)
    const guideStations = buildGuideStationLookup(artworks)
    const locale = resolveRequestedLocales(
      show,
      req.query.locale ?? show.defaultLocale,
      "public"
    )[0]
    const artwork = artworks.find((entry) => entry.id === req.params.id)

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    if (!isGuidedArtwork(artwork)) {
      res.status(409).json({
        message:
          "Signage-only artworks do not have QR codes because they are not published in the visitor guide."
      })
      return
    }

    const qrItem = await buildQrItem(req, artwork, locale, guideStations)

    if (req.query.download) {
      res.setHeader("Content-Type", "image/svg+xml")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${artwork.id}-${locale}.svg"`
      )
      res.send(qrItem.svg)
      return
    }

    res.json(qrItem)
  })
)

app.get(
  "/api/print-sheet",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = resolveRequestedLocales(
      show,
      req.query.locale ?? show.defaultLocale,
      "public"
    )[0]
    const mode = (req.query.mode as PrintLayoutMode | undefined) ?? "labels"
    const ids = `${req.query.ids ?? ""}`
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const artworks = loadArtworksSync(showId)
    const guideStations = buildGuideStationLookup(artworks)
    const selected = ids.length
      ? artworks.filter((artwork) => ids.includes(artwork.id))
      : artworks
    const printable =
      mode === "labels" ? selected.filter(isGuidedArtwork) : selected
    const items = await Promise.all(
      printable.map((artwork) =>
        buildQrItem(req, artwork, locale, guideStations)
      )
    )
    const payload: PrintSheetPayload = {
      locale,
      mode,
      items
    }

    res.json(payload)
  })
)

app.get(
  "/api/entrance-sign",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = resolveRequestedLocales(
      show,
      req.query.locale ?? show.defaultLocale,
      "public"
    )[0]

    res.json(await buildEntranceSignPayload(req, locale))
  })
)

app.get(
  "/api/shows/:id/backup",
  asyncRoute(async (req, res) => {
    const targetShowId = `${req.params.id}`.trim()
    const { archivePath } = await createShowBackup({ showId: targetShowId })

    res.setHeader("Content-Type", "application/gzip")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(archivePath)}"`
    )
    res.send(fs.readFileSync(archivePath))
  })
)

app.post(
  "/api/show-backups/import",
  backupUpload.single("backup"),
  asyncRoute(async (req, res) => {
    const file = req.file

    if (!file) {
      res.status(400).json({ message: "Backup import requires a file." })
      return
    }

    try {
      const result = await importShowBackup({
        archivePath: file.path,
        targetShowId: `${req.body?.targetShowId ?? ""}`.trim() || undefined
      })

      res.json({
        ...createDashboardPayload(req),
        importedShowId: result.importedShowId
      })
    } finally {
      fs.rmSync(file.path, { force: true })
    }
  })
)

app.post(
  "/api/shows/:id/activate",
  asyncRoute(async (req, res) => {
    const nextShowId = `${req.params.id}`.trim()

    setActiveShowId(nextShowId)
    showId = nextShowId
    ensureShowDirectories(showId)
    res.json(createDashboardPayload(req))
  })
)

app.get(
  "/api/signage.pdf",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = resolveRequestedLocales(
      show,
      req.query.locale ?? show.defaultLocale,
      "public"
    )[0]
    const variant =
      (req.query.variant as SignagePdfVariant | undefined) ?? "sheet"
    const cutMarks = `${req.query.cutMarks ?? "true"}` !== "false"
    const ids = `${req.query.ids ?? ""}`
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const artworks = loadArtworksSync(showId)
    const guideStations = buildGuideStationLookup(artworks)
    const selected = ids.length
      ? artworks.filter((artwork) => ids.includes(artwork.id))
      : artworks
    const items = await Promise.all(
      selected.map((artwork) =>
        buildQrItem(req, artwork, locale, guideStations)
      )
    )

    if (!items.length) {
      res.status(400).json({
        message: "At least one artwork must be selected for signage export."
      })
      return
    }

    const pdf = await buildSignagePdf({
      cutMarks,
      fileNameBase: `${showId}-${locale}`,
      items,
      locale,
      logoAssetPath: path.resolve(
        "public",
        show.branding.logoSrc.replace(/^\//, "")
      ),
      variant
    })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${showId}-${locale}-${variant}-artwork-signs.pdf"`
    )
    res.send(pdf)
  })
)

app.get(
  "/api/entrance-sign.pdf",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const show = loadShowSync(showId)
    const locale = resolveRequestedLocales(
      show,
      req.query.locale ?? show.defaultLocale,
      "public"
    )[0]
    const payload = await buildEntranceSignPayload(req, locale)
    const pdf = await buildEntranceSignPdf({
      payload,
      logoAssetPath: path.resolve(
        "public",
        show.branding.logoSrc.replace(/^\//, "")
      )
    })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${showId}-${locale}-entrance-sign.pdf"`
    )
    res.send(pdf)
  })
)

app.get(
  "/api/signage-cut.svg",
  asyncRoute(async (req, res) => {
    const showId = currentShowId()
    const ids = `${req.query.ids ?? ""}`
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const artworks = loadArtworksSync(showId)
    const selected = ids.length
      ? artworks.filter((artwork) => ids.includes(artwork.id))
      : artworks

    if (!selected.length) {
      res.status(400).json({
        message: "Select at least one artwork for the LightBurn cut export."
      })
      return
    }

    if (selected.length > 8) {
      res.status(400).json({
        message: "Select up to 8 artworks for one A3 LightBurn cut export."
      })
      return
    }

    const svg = buildLightburnSignageCutSvg({
      items: selected.map((artwork) => ({ id: artwork.id })),
      showId
    })

    res.setHeader("Content-Type", "image/svg+xml")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${showId}-lightburn-signage-cut-template.svg"`
    )
    res.send(svg)
  })
)

app.post(
  "/api/export",
  asyncRoute(async (_req, res) => {
    const showId = currentShowId()
    const audit = auditShowBundle(loadShowBundleSync(showId))

    if (!audit.ready) {
      res.status(409).json({
        ...audit,
        logs: "Export blocked until all required translations, media, and audio files are ready."
      })
      return
    }

    const logs: string[] = []
    const child = spawn("npm", ["run", "build"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SHOW: showId,
        SHOWS_DIR: env.SHOWS_DIR
      },
      shell: true
    })

    await new Promise<void>((resolve, reject) => {
      child.stdout.on("data", (chunk) => logs.push(chunk.toString()))
      child.stderr.on("data", (chunk) => logs.push(chunk.toString()))
      child.on("close", (code) => {
        if (code === 0) {
          resolve()
          return
        }

        reject(new Error(`Build exited with ${code}`))
      })
      child.on("error", reject)
    })

    res.json({
      ...audit,
      logs: logs.join("")
    })
  })
)
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    res.status(500).json({
      message: error.message
    })
  }
)

app.listen(port, "0.0.0.0", () => {
  console.log(`Promenade studio API listening on http://0.0.0.0:${port}`)
})
