import {
  buildGuideStations,
  findGuideStationByArtworkId,
  findGuideStationByStationId
} from "@lib/guide-stations"
import { createLocaleRecord, type Artwork } from "@lib/schema"
import { describe, expect, it } from "vitest"

function createArtwork(
  id: string,
  number: number,
  guideMode: Artwork["guideMode"]
): Artwork {
  return {
    id,
    number,
    slug: `artwork-${id}`,
    guideMode,
    artist: "Artist",
    year: "",
    sourceLocale: "de",
    titleLocale: "de",
    title: createLocaleRecord(`Artwork ${id}`),
    titleSubtitle: createLocaleRecord(""),
    sourceDescription: createLocaleRecord(""),
    description: createLocaleRecord(""),
    material: createLocaleRecord(""),
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
      voiceId: "",
      generatedAt: "",
      outputPath: "",
      seed: 0
    })),
    translationStatus: createLocaleRecord("missing"),
    audioCueStatus: createLocaleRecord("missing"),
    audioStatus: createLocaleRecord("missing")
  }
}

describe("guide stations", () => {
  it("assigns consecutive guide numbers independent of internal artwork ids", () => {
    const artworks = [
      createArtwork("01", 1, "guided"),
      createArtwork("02", 2, "signage-only"),
      createArtwork("07", 7, "guided"),
      createArtwork("42", 42, "guided")
    ]

    expect(buildGuideStations(artworks).map((entry) => entry.stationId)).toEqual(
      ["01", "02", "03"]
    )
  })

  it("resolves guide stations by artwork id and by station id", () => {
    const artworks = [
      createArtwork("01", 1, "guided"),
      createArtwork("09", 9, "guided"),
      createArtwork("13", 13, "guided")
    ]

    expect(findGuideStationByArtworkId(artworks, "09")?.stationId).toBe("02")
    expect(findGuideStationByStationId(artworks, "03")?.artworkId).toBe("13")
  })
})
