import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  createEmptyArtwork,
  ensureShowDirectories,
  getActiveShowId,
  getArtworkFilePath,
  getShowDir,
  loadArtworksSync,
  loadShowBundleSync,
  loadShowSync,
  writeArtworkSync,
  writeShowSync
} from "@lib/content"
import { getServerEnv } from "@lib/env.server"
import { auditShowBundle } from "@lib/export"
import { buildArtworkUrl } from "@lib/routing"
import {
  type Artwork,
  artworkSchema,
  type Locale,
  showSchema
} from "@lib/schema"
import type {
  DashboardPayload,
  PrintSheetItem,
  PrintSheetPayload
} from "@lib/studio"
import cors from "cors"
import express from "express"
import multer from "multer"
import QRCode from "qrcode"

const app = express()
const env = getServerEnv()
const showId = getActiveShowId()
const port = Number.parseInt(process.env.PORT ?? "8787", 10)

ensureShowDirectories(showId)

app.set("trust proxy", true)
app.use(cors())
app.use(express.json({ limit: "4mb" }))
app.use("/shows", express.static(path.resolve("public/shows")))
app.use("/icons", express.static(path.resolve("public/icons")))

const upload = multer({
  storage: multer.memoryStorage()
})

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
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

async function generateTranslationDraft(artwork: Artwork) {
  if (!env.OPENAI_API_KEY) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error("Translation requires OPENAI_API_KEY.")
    }

    return {
      title: artwork.title.en || `[Draft] ${artwork.title.de}`,
      description:
        artwork.description.en ||
        `Draft translation: ${artwork.description.de}`,
      material:
        artwork.material.en || `Draft translation: ${artwork.material.de}`
    }
  }

  return callOpenAiJson<{
    title: string
    description: string
    material: string
  }>({
    prompt:
      "You are a museum translation editor. Translate German curatorial copy into natural, elegant English. Preserve factual meaning, avoid marketing language, and keep the rhythm pleasant for both reading and later text-to-speech use.",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        material: { type: "string" }
      },
      additionalProperties: false,
      required: ["title", "description", "material"]
    },
    payload: {
      title: artwork.title.de,
      description: artwork.description.de,
      material: artwork.material.de,
      artist: artwork.artist,
      year: artwork.year
    }
  })
}

function buildMockCueText(artwork: Artwork, locale: Locale) {
  if (locale === "de") {
    return [
      "Atmosphäre: warm, aufmerksam, leicht staunend.",
      "Tempo: ruhig beginnen, dann bei der Bildbewegung etwas anziehen.",
      `Bildfokus: ${artwork.title.de || artwork.title.en || artwork.id} mit einer klaren visuellen Beobachtung verankern.`,
      "Pausen und Aussprache: nach dem Werktitel kurz atmen und Materialbegriffe deutlich setzen."
    ].join("\n")
  }

  return [
    "Atmosphere: warm, observant, gently vivid.",
    "Pacing: begin calmly, then add a touch of lift when the visual movement appears.",
    `Visual focus: anchor the narration in ${artwork.title.en || artwork.title.de || artwork.id} with one concrete visual observation.`,
    "Pauses and pronunciation: leave a small pause after the title and articulate material terms cleanly."
  ].join("\n")
}

function getCueGenerationPrompt(styleGuide: string, locale: Locale) {
  if (locale === "de") {
    return `${styleGuide}

Du schreibst Regieanweisungen fuer einen hochwertigen Museums-Audioguide auf Deutsch.
Ziel: Die spaetere Stimme soll lebendig, bildnah und elegant klingen, nicht wie eine vorgelesene Wandtafel.
Jedes Ergebnis muss die Eigenart dieses konkreten Werks hoerbar machen. Vermeide austauschbare Museumsphrasen.

Schreibe genau vier Zeilen und beginne jede Zeile mit einem dieser Labels:
Atmosphaere:
Tempo:
Bildfokus:
Pausen/Betonung:

Qualitaetsregeln:
- Nutze nur Informationen aus dem gelieferten Material; erfinde nichts.
- Atmosphaere soll Licht, Dichte, Temperatur oder emotionale Spannung greifbar machen.
- Tempo soll einen kleinen Bogen im Sprechfluss beschreiben, nicht nur "langsam" oder "ruhig".
- Bildfokus muss ein sichtbares Detail, eine Formbeziehung oder eine Blickbewegung nennen.
- Passen Sie nur dann Aussprachehinweise ein, wenn Namen wirklich erklaerungsbeduerftig sind; sonst gib eine konkrete Pause- oder Betonungsanweisung.
- Vermeide Formeln wie "interessant", "faszinierend", "Meisterwerk", "ikonisch" oder "Dieses Werk zeigt".
- Wiederhole keine ganzen Saetze aus der Beschreibung.`
  }

  return `${styleGuide}

You write direction notes for a premium museum audio guide in English.
Goal: the final voice should feel vivid, image-led, and composed, not like a wall label being read aloud.
Every result must sound specific to this artwork. Avoid reusable museum boilerplate.

Write exactly four lines and start each line with one of these labels:
Atmosphere:
Pacing:
Visual focus:
Pauses/emphasis:

Quality rules:
- Use only the supplied facts; do not invent context.
- Atmosphere should make light, density, temperature, or emotional tension feel tangible.
- Pacing should describe a small arc in delivery, not just "slow" or "calm".
- Visual focus must name a visible detail, shape relationship, or movement of the eye.
- Give pronunciation help only when a name is genuinely non-obvious; otherwise use the line for pause or emphasis guidance.
- Avoid words like "iconic", "captivating", "interesting", "masterpiece", or formulas like "this painting shows" and "we can see".
- Do not repeat full sentences from the description.`
}

function getNarrationPrompt(styleGuide: string, locale: Locale) {
  if (locale === "de") {
    return `${styleGuide}

Du schreibst den finalen Sprechtext fuer einen Museums-Audioguide und bereitest ihn fuer Text-to-Speech vor.
Die Cue-Sheet-Hinweise sind verbindlich fuer Rhythmus, Blickfuehrung und Gewichtung.
Ziel: dynamischer und sinnlicher als eine Wandtafel, aber glaubwuerdig, praezise und ohne Pathos.

Liefere:
- script: ein einziger gesprochener Absatz von hoechstens 90 Sekunden.
- speechText: inhaltlich derselbe Absatz, aber fuer ElevenLabs geformt; nutze natuerliche Interpunktion und hoechstens zwei <break time="0.xs" /> Tags.
- fallbackInstructions: zwei oder drei knappe Saetze fuer TTS-Systeme mit getrenntem Instructions-Feld.

Qualitaetsregeln:
- Beginne in der unmittelbaren Bildwahrnehmung und weite erst dann den Blick.
- Variiere Satzlaengen und baue einen kleinen Spannungsbogen auf.
- Nenne Kuenstler, Titel und mindestens eine konkrete visuelle Beobachtung.
- Vermeide Formeln wie "Dieses Werk zeigt", "Wir sehen", "Meisterwerk", "ikonisch" oder "faszinierend".
- Erfinde keine Fakten.
- Forme Jahreszahlen, Datumsangaben, Massangaben, Abkuerzungen und symbolreiche Stellen so um, dass sie natuerlich gesprochen werden.
- Beende den Absatz mit einem Nachbild, einer Spannung oder einer offenen Wahrnehmung, nicht mit einer generischen Zusammenfassung.
- Fuer speechText: bevorzuge natuerliche Interpunktion und setze <break>-Tags sparsam und gezielt ein; niemals stapeln.
- Fuehre Emotion ueber Wortwahl und Satzrhythmus, nicht ueber ausgesprochene Regieanweisungen.
- speechText darf keine Regieanweisungen oder Labels enthalten.`
  }

  return `${styleGuide}

You write final spoken copy for a museum audio guide and prepare it for text-to-speech.
The cue sheet is binding for rhythm, visual direction, and emphasis.
Goal: more dynamic and sensuous than a wall label, while still credible, precise, and composed.

Return:
- script: a single spoken paragraph of no more than 90 seconds.
- speechText: the same content shaped for ElevenLabs; use natural punctuation and at most two <break time="0.xs" /> tags.
- fallbackInstructions: two or three short sentences for TTS systems that support a separate instructions field.

Quality rules:
- Start inside the immediate visual experience before widening the frame.
- Vary sentence length and build a small arc of energy.
- Mention artist, title, and at least one concrete visual observation.
- Avoid formulas like "this painting shows", "we can see", "iconic", "captivating", or "masterpiece".
- Do not invent facts.
- Normalize years, dates, dimensions, acronyms, and symbol-heavy fragments into naturally speakable wording.
- End on an after-image, tension, or unresolved perception rather than a generic summary.
- For speechText, prefer natural punctuation first and use <break> tags sparingly and deliberately; never stack them.
- Carry emotion through word choice and sentence rhythm rather than spoken stage directions.
- speechText must not contain labels or stage directions.`
}

function didLocaleNarrationInputsChange(
  current: Artwork,
  next: Artwork,
  locale: Locale
) {
  return (
    current.artist.trim() !== next.artist.trim() ||
    current.year.trim() !== next.year.trim() ||
    current.title[locale].trim() !== next.title[locale].trim() ||
    current.description[locale].trim() !== next.description[locale].trim() ||
    current.material[locale].trim() !== next.material[locale].trim()
  )
}

function normalizeArtworkForWrite(existing: Artwork | null, artwork: Artwork) {
  const normalizedArtwork = artworkSchema.parse({
    ...artwork,
    slug:
      artwork.slug ||
      slugify(
        artwork.title.en || artwork.title.de || artwork.artist || artwork.id
      )
  })

  if (!existing) {
    return normalizedArtwork
  }

  const nextArtwork = structuredClone(normalizedArtwork)

  for (const locale of ["de", "en"] as const) {
    const sourceChanged = didLocaleNarrationInputsChange(
      existing,
      normalizedArtwork,
      locale
    )
    const cueChanged =
      existing.audioCues[locale].trim() !==
      normalizedArtwork.audioCues[locale].trim()

    if (sourceChanged && !cueChanged) {
      nextArtwork.audioCueStatus[locale] = normalizedArtwork.audioCues[
        locale
      ].trim()
        ? "draft"
        : "missing"
    } else if (cueChanged) {
      nextArtwork.audioCueStatus[locale] = normalizedArtwork.audioCues[
        locale
      ].trim()
        ? "ready"
        : "missing"
    }

    if (sourceChanged || cueChanged) {
      nextArtwork.audioStatus[locale] = normalizedArtwork.audio[locale].trim()
        ? "draft"
        : "missing"
    }
  }

  return artworkSchema.parse(nextArtwork)
}

async function generateArtworkCueText(artwork: Artwork, locale: Locale) {
  const show = loadShowSync(showId)

  if (!env.OPENAI_API_KEY) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error("Cue generation requires OPENAI_API_KEY.")
    }

    return buildMockCueText(artwork, locale)
  }

  const result = await callOpenAiJson<{ cueText: string }>({
    prompt: getCueGenerationPrompt(show.audioGuideStyle[locale], locale),
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
      title: artwork.title[locale],
      year: artwork.year,
      material: artwork.material[locale],
      description: artwork.description[locale]
    }
  })

  return result.cueText.trim()
}

async function ensureArtworkCue(artwork: Artwork, locale: Locale) {
  if (
    artwork.audioCueStatus[locale] === "ready" &&
    artwork.audioCues[locale].trim()
  ) {
    return artwork
  }

  const cueText = await generateArtworkCueText(artwork, locale)

  return artworkSchema.parse({
    ...artwork,
    audioCues: {
      ...artwork.audioCues,
      [locale]: cueText
    },
    audioCueStatus: {
      ...artwork.audioCueStatus,
      [locale]: "ready"
    }
  })
}

async function generateNarrationPlan(artwork: Artwork, locale: Locale) {
  const show = loadShowSync(showId)
  const baseText = artwork.description[locale]
  const cueText = artwork.audioCues[locale].trim()
  const fallbackInstructions = [
    show.audioGuideStyle[locale],
    cueText ? `Artwork-specific delivery cues:\n${cueText}` : "",
    locale === "de"
      ? "Sprich klar, bildhaft und mit natürlichen Pausen, ohne theatralisch zu werden."
      : "Speak clearly, vividly, and with natural pauses, without becoming theatrical."
  ]
    .filter(Boolean)
    .join("\n\n")

  if (!env.OPENAI_API_KEY) {
    return {
      script: baseText,
      speechText: baseText,
      fallbackInstructions
    }
  }

  const result = await callOpenAiJson<{
    script: string
    speechText: string
    fallbackInstructions: string
  }>({
    prompt: getNarrationPrompt(show.audioGuideStyle[locale], locale),
    schema: {
      type: "object",
      properties: {
        script: { type: "string" },
        speechText: { type: "string" },
        fallbackInstructions: { type: "string" }
      },
      additionalProperties: false,
      required: ["script", "speechText", "fallbackInstructions"]
    },
    payload: {
      locale,
      cues: cueText,
      artist: artwork.artist,
      title: artwork.title[locale],
      year: artwork.year,
      material: artwork.material[locale],
      description: baseText
    }
  })

  return result
}

async function synthesizeWithElevenLabs(locale: Locale, text: string) {
  const apiKey = env.ELEVENLABS_API_KEY
  const voiceId =
    locale === "de" ? env.ELEVENLABS_DE_VOICE_ID : env.ELEVENLABS_EN_VOICE_ID

  if (!apiKey || !voiceId) {
    return null
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
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
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.82,
          style: 0.32,
          use_speaker_boost: true
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed with ${response.status}.`)
  }

  return {
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

  const voice = locale === "de" ? "sage" : "marin"
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
      response_format: "wav"
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI TTS request failed with ${response.status}.`)
  }

  return {
    extension: "wav",
    buffer: Buffer.from(await response.arrayBuffer())
  }
}

async function generateArtworkAudio(artwork: Artwork, locale: Locale) {
  const plan = await generateNarrationPlan(artwork, locale)
  const audioRoot = path.resolve("public", "shows", showId, "media", "audio")
  fs.mkdirSync(audioRoot, { recursive: true })

  let output =
    (await synthesizeWithElevenLabs(locale, plan.speechText).catch(
      () => null
    )) ??
    (await synthesizeWithOpenAi(
      locale,
      plan.script,
      plan.fallbackInstructions
    ).catch(() => null))

  if (!output) {
    if (!env.STUDIO_ALLOW_MOCK_AI) {
      throw new Error(
        "Audio generation requires ElevenLabs or OpenAI credentials."
      )
    }

    output = {
      extension: "wav",
      buffer: createToneWavBuffer(artwork.number + (locale === "de" ? 1 : 9))
    }
  }

  const fileName = `${artwork.id}-${locale}.${output.extension}`
  fs.writeFileSync(path.join(audioRoot, fileName), output.buffer)

  return `/shows/${showId}/media/audio/${fileName}`
}

async function buildQrItem(
  req: express.Request,
  artwork: Artwork,
  locale: Locale
): Promise<PrintSheetItem> {
  const show = loadShowSync(showId)
  const studioOrigin = getRequestOrigin(req)
  const url = buildArtworkUrl(locale, artwork, env.PUBLIC_SITE_URL)
  const svg = await QRCode.toString(url, {
    margin: 1,
    type: "svg",
    width: 320,
    color: {
      dark: show.branding.ink,
      light: "#ffffff"
    }
  })
  const qrDir = path.join(getShowDir(showId), "generated", "qrs", locale)
  const filePath = path.join(qrDir, `${artwork.id}.svg`)

  fs.mkdirSync(qrDir, { recursive: true })
  fs.writeFileSync(filePath, svg)

  const parsedUrl = new URL(url)

  return {
    id: artwork.id,
    artist: artwork.artist,
    title: artwork.title[locale],
    locale,
    logoSrc: `${studioOrigin}${show.branding.logoSrc}`,
    url,
    humanUrl: `${parsedUrl.host}${parsedUrl.pathname}`,
    svg,
    downloadUrl: `${studioOrigin}/api/artworks/${artwork.id}/qr?locale=${locale}&download=1`
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

  return env.STUDIO_API_ORIGIN
}

function createDashboardPayload(req?: express.Request): DashboardPayload {
  const bundle = loadShowBundleSync(showId)
  const audit = auditShowBundle(bundle)
  const studioOrigin = req ? getRequestOrigin(req) : env.STUDIO_API_ORIGIN

  return {
    bundle,
    audit,
    showId,
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

app.put(
  "/api/show",
  asyncRoute(async (req, res) => {
    const nextShow = showSchema.parse(req.body)
    writeShowSync(showId, nextShow)
    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks",
  asyncRoute(async (req, res) => {
    const artwork = createEmptyArtwork(showId)
    writeArtworkSync(showId, artwork)
    res.status(201).json(createDashboardPayload(req))
  })
)

app.put(
  "/api/artworks/:id",
  asyncRoute(async (req, res) => {
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
          de: `${artwork.title.de || artwork.artist} – Upload ${artwork.images.length + 1}`,
          en: `${artwork.title.en || artwork.artist} – Upload ${artwork.images.length + 1}`
        },
        kind: artwork.images.length ? "detail" : "hero"
      })
    }

    writeArtworkSync(showId, artwork)
    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/:id/translate",
  asyncRoute(async (req, res) => {
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    const draft = await generateTranslationDraft(artwork)

    writeArtworkSync(
      showId,
      normalizeArtworkForWrite(artwork, {
        ...artwork,
        title: { ...artwork.title, en: draft.title },
        description: { ...artwork.description, en: draft.description },
        material: { ...artwork.material, en: draft.material },
        audioCues: {
          ...artwork.audioCues,
          en: ""
        },
        translationStatus: {
          ...artwork.translationStatus,
          en: "draft"
        }
      })
    )

    res.json(createDashboardPayload(req))
  })
)

app.post(
  "/api/artworks/:id/audio-cues",
  asyncRoute(async (req, res) => {
    const locale = (req.body?.locale ?? "both") as Locale | "both"
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    const targetLocales: Locale[] = locale === "both" ? ["de", "en"] : [locale]
    let nextArtwork = structuredClone(artwork)

    for (const currentLocale of targetLocales) {
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
    const locale = (req.body?.locale ?? "both") as Locale | "both"
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    const targetLocales: Locale[] = locale === "both" ? ["de", "en"] : [locale]
    let nextArtwork = structuredClone(artwork)

    for (const currentLocale of targetLocales) {
      nextArtwork = await ensureArtworkCue(nextArtwork, currentLocale)
      const audioPath = await generateArtworkAudio(nextArtwork, currentLocale)
      nextArtwork.audio = {
        ...nextArtwork.audio,
        [currentLocale]: audioPath
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
    const locale = (req.query.locale as Locale | undefined) ?? "de"
    const artwork = loadArtworksSync(showId).find(
      (entry) => entry.id === req.params.id
    )

    if (!artwork) {
      res.status(404).json({ message: "Artwork not found." })
      return
    }

    const qrItem = await buildQrItem(req, artwork, locale)

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
    const locale = (req.query.locale as Locale | undefined) ?? "de"
    const ids = `${req.query.ids ?? ""}`
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const artworks = loadArtworksSync(showId)
    const selected = ids.length
      ? artworks.filter((artwork) => ids.includes(artwork.id))
      : artworks
    const items = await Promise.all(
      selected.map((artwork) => buildQrItem(req, artwork, locale))
    )
    const payload: PrintSheetPayload = {
      locale,
      items
    }

    res.json(payload)
  })
)

app.post(
  "/api/export",
  asyncRoute(async (_req, res) => {
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
