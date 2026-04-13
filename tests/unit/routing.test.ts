import {
  buildArtworkPath,
  buildGuideArtworkPath,
  parseArtworkTargetFromQrInput
} from "@lib/routing"
import { describe, expect, it } from "vitest"

describe("qr routing", () => {
  it("maps plain guide numbers to guide paths", () => {
    expect(parseArtworkTargetFromQrInput("7", "de", { id: "demo-show" })).toBe(
      buildGuideArtworkPath("de", "07")
    )
  })

  it("maps absolute URLs with guide paths", () => {
    expect(
      parseArtworkTargetFromQrInput(
        "https://promenade.example.com/en/guide/03/",
        "de",
        { id: "demo-show" }
      )
    ).toBe("/de/guide/03/")
  })

  it("keeps legacy artwork-id paths intact", () => {
    expect(
      parseArtworkTargetFromQrInput(
        "https://promenade.example.com/en/artworks/03/",
        "de",
        { id: "demo-show" }
      )
    ).toBe(buildArtworkPath("de", { id: "03" }))
  })

  it("maps legacy query-string URLs", () => {
    expect(
      parseArtworkTargetFromQrInput(
        "https://promenade.example.com/index.html?artwork=10",
        "en",
        { id: "demo-show" }
      )
    ).toBe("/en/artworks/10/")
  })
})
