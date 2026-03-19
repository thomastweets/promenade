import { buildArtworkPath, parseArtworkTargetFromQrInput } from "@lib/routing"
import { describe, expect, it } from "vitest"

describe("qr routing", () => {
  it("maps plain artwork numbers to locale paths", () => {
    expect(parseArtworkTargetFromQrInput("7", "de", { id: "demo-show" })).toBe(
      buildArtworkPath("de", { id: "07" })
    )
  })

  it("maps absolute URLs with route paths", () => {
    expect(
      parseArtworkTargetFromQrInput(
        "https://promenade.example.com/en/artworks/03/",
        "de",
        { id: "demo-show" }
      )
    ).toBe("/de/artworks/03/")
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
