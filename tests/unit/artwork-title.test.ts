import {
  getArtworkDisplayTitle,
  getArtworkTitleParts,
  getAuthoritativeArtworkTitle,
  resolveArtworkTitleLocale
} from "@lib/artwork-title"
import { describe, expect, it } from "vitest"

describe("artwork title helpers", () => {
  it("keeps the authoritative title and exposes translated subtitles separately", () => {
    const artwork = {
      titleLocale: "es" as const,
      title: {
        de: "Las Moiras",
        en: "Las Moiras",
        es: "Las Moiras"
      },
      titleSubtitle: {
        de: "Die drei Moiras",
        en: "The Moirai",
        es: ""
      }
    }

    expect(getAuthoritativeArtworkTitle(artwork, "de")).toBe("Las Moiras")
    expect(getArtworkTitleParts(artwork, "de")).toEqual({
      title: "Las Moiras",
      subtitle: "Die drei Moiras",
      titleLocale: "es"
    })
    expect(getArtworkDisplayTitle(artwork, "en")).toBe(
      "Las Moiras (The Moirai)"
    )
  })

  it("supports authoritative titles outside the published app locales", () => {
    const artwork = {
      titleLocale: "other" as const,
      title: {
        de: "La Belle",
        en: "La Belle",
        es: "La Belle"
      },
      titleSubtitle: {
        de: "Die Schoene",
        en: "The Beautiful One",
        es: "La bella"
      }
    }

    expect(resolveArtworkTitleLocale(artwork, "de")).toBe("other")
    expect(getAuthoritativeArtworkTitle(artwork, "en")).toBe("La Belle")
    expect(getArtworkTitleParts(artwork, "de")).toEqual({
      title: "La Belle",
      subtitle: "Die Schoene",
      titleLocale: "other"
    })
  })
})
