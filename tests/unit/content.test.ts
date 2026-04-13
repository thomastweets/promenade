import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { seedDemoShow } from "../../scripts/seed-demo-show.mjs"

let showsDir: string | null = null

async function loadSeededContentModule() {
  showsDir = fs.mkdtempSync(path.join(os.tmpdir(), "promenade-unit-content-"))
  await seedDemoShow({ showsDir })
  process.env.SHOW = "demo-show"
  process.env.SHOWS_DIR = showsDir
  vi.resetModules()
  return import("@lib/content")
}

afterEach(() => {
  if (showsDir) {
    fs.rmSync(showsDir, { recursive: true, force: true })
    showsDir = null
  }

  delete process.env.SHOW
  delete process.env.SHOWS_DIR
  vi.resetModules()
})

describe("content authoring drafts", () => {
  it("creates a blank artwork draft that can be edited before export", async () => {
    const { createEmptyArtwork } = await loadSeededContentModule()
    const artwork = createEmptyArtwork()

    expect(artwork.artist).toBe("")
    expect(artwork.guideMode).toBe("guided")
    expect(artwork.images).toEqual([])
    expect(artwork.audioCues).toEqual({ de: "", en: "", es: "" })
    expect(artwork.sourceLocale).toBe("de")
    expect(artwork.titleLocale).toBe("de")
    expect(artwork.sourceDescription).toEqual({ de: "", en: "", es: "" })
    expect(artwork.narrationRecord.de.speechText).toBe("")
    expect(artwork.narrationRecord.de.provider).toBe("none")
    expect(artwork.title.de).toBe("")
    expect(artwork.titleSubtitle).toEqual({ de: "", en: "", es: "" })
    expect(artwork.audioCueStatus.de).toBe("missing")
    expect(artwork.audioStatus.de).toBe("missing")
  })

  it("assigns the next sequential artwork id and number", async () => {
    const { createEmptyArtwork, loadArtworksSync } =
      await loadSeededContentModule()
    const artworks = loadArtworksSync()
    const expectedNumber = artworks[artworks.length - 1].number + 1
    const artwork = createEmptyArtwork()

    expect(artwork.id).toBe(`${expectedNumber}`.padStart(2, "0"))
    expect(artwork.number).toBe(expectedNumber)
    expect(artwork.slug).toBe(`artwork-${`${expectedNumber}`.padStart(2, "0")}`)
  })

  it("exposes a filtered guide-artwork list for the public app", async () => {
    const { loadGuideArtworksSync, loadArtworksSync, writeArtworkSync } =
      await loadSeededContentModule()
    const artworks = loadArtworksSync()
    const initialGuideArtworks = loadGuideArtworksSync()
    const signageOnly = {
      ...artworks[0],
      guideMode: "signage-only" as const
    }

    writeArtworkSync("demo-show", signageOnly)

    const guideArtworks = loadGuideArtworksSync()

    expect(guideArtworks).toHaveLength(initialGuideArtworks.length - 1)
    expect(guideArtworks.some((artwork) => artwork.id === signageOnly.id)).toBe(
      false
    )
  })
})
