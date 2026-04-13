import { applyDerivedGenerationStatuses } from "@lib/generation-status"
import { artworkSchema, createLocaleRecord, type Artwork } from "@lib/schema"
import { describe, expect, it } from "vitest"

function createArtwork(overrides: Partial<Artwork> = {}) {
  return artworkSchema.parse({
    id: "01",
    number: 1,
    slug: "artwork-01",
    guideMode: "guided",
    artist: "Test Artist",
    year: "2026",
    sourceLocale: "de",
    titleLocale: "de",
    title: createLocaleRecord("Celeste"),
    titleSubtitle: createLocaleRecord(""),
    sourceDescription: createLocaleRecord(""),
    description: createLocaleRecord(""),
    material: createLocaleRecord("Öl auf Leinwand"),
    dimensions: "",
    images: [],
    audioCues: createLocaleRecord(""),
    audio: createLocaleRecord(""),
    narrationRecord: createLocaleRecord(() => ({
      baseText: "",
      speechText: "",
      cueTextUsed: "",
      instructionsUsed: "",
      provider: "none",
      model: "",
      generatedAt: "",
      outputPath: "",
      voiceId: "",
      seed: 0
    })),
    translationStatus: {
      de: "human",
      en: "draft",
      es: "draft"
    },
    audioCueStatus: {
      de: "ready",
      en: "ready",
      es: "missing"
    },
    audioStatus: {
      de: "ready",
      en: "ready",
      es: "missing"
    },
    ...overrides
  })
}

describe("generation status helpers", () => {
  it("marks only changed locales as draft when cue and audio text already exist", () => {
    const current = createArtwork({
      description: {
        de: "Alte Fassung",
        en: "Existing English copy",
        es: ""
      },
      audioCues: {
        de: "Atmosphere: ruhig",
        en: "Atmosphere: calm",
        es: ""
      },
      audio: {
        de: "/audio/de.mp3",
        en: "/audio/en.mp3",
        es: ""
      }
    })

    const next = createArtwork({
      description: {
        de: "Neue Fassung",
        en: "Existing English copy",
        es: ""
      },
      audioCues: current.audioCues,
      audio: current.audio
    })

    const updated = applyDerivedGenerationStatuses(current, next, [
      "de",
      "en",
      "es"
    ])

    expect(updated.audioCueStatus.de).toBe("draft")
    expect(updated.audioStatus.de).toBe("draft")
    expect(updated.audioCueStatus.en).toBe("ready")
    expect(updated.audioStatus.en).toBe("ready")
    expect(updated.audioCueStatus.es).toBe("missing")
    expect(updated.audioStatus.es).toBe("missing")
  })

  it("keeps statuses missing when changed locales do not yet have generated outputs", () => {
    const current = createArtwork({
      description: {
        de: "Quelle",
        en: "",
        es: ""
      },
      audioCues: createLocaleRecord(""),
      audio: createLocaleRecord(""),
      audioCueStatus: createLocaleRecord("missing"),
      audioStatus: createLocaleRecord("missing")
    })

    const next = createArtwork({
      description: {
        de: "Quelle",
        en: "",
        es: "Nuevo texto"
      },
      audioCues: createLocaleRecord(""),
      audio: createLocaleRecord(""),
      audioCueStatus: createLocaleRecord("missing"),
      audioStatus: createLocaleRecord("missing")
    })

    const updated = applyDerivedGenerationStatuses(current, next, [
      "de",
      "en",
      "es"
    ])

    expect(updated.audioCueStatus.es).toBe("missing")
    expect(updated.audioStatus.es).toBe("missing")
  })
})
