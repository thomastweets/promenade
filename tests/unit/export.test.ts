import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { seedDemoShow } from "../../scripts/seed-demo-show.mjs"

let showsDir: string | null = null

async function loadSeededModules() {
  showsDir = fs.mkdtempSync(path.join(os.tmpdir(), "promenade-unit-export-"))
  await seedDemoShow({ showsDir })
  process.env.SHOW = "demo-show"
  process.env.SHOWS_DIR = showsDir
  vi.resetModules()

  const content = await import("@lib/content")
  const exported = await import("@lib/export")

  return {
    loadShowBundleSync: content.loadShowBundleSync,
    auditShowBundle: exported.auditShowBundle
  }
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

describe("export audit", () => {
  it("accepts the seeded demo show", async () => {
    const { auditShowBundle, loadShowBundleSync } = await loadSeededModules()
    const audit = auditShowBundle(loadShowBundleSync())

    expect(audit.ready).toBe(true)
    expect(audit.issues).toHaveLength(0)
  })

  it("blocks export when English translation is not approved", async () => {
    const { auditShowBundle, loadShowBundleSync } = await loadSeededModules()
    const bundle = loadShowBundleSync()
    bundle.artworks[0].translationStatus.en = "draft"

    const audit = auditShowBundle(bundle)

    expect(audit.ready).toBe(false)
    expect(
      audit.issues.some((issue) =>
        issue.message.includes("English translation")
      )
    ).toBe(true)
  })

  it("blocks export when a referenced image asset is missing", async () => {
    const { auditShowBundle, loadShowBundleSync } = await loadSeededModules()
    const bundle = loadShowBundleSync()
    bundle.artworks[0].images[0].src =
      "/shows/demo-show/media/images/missing-image.svg"

    const audit = auditShowBundle(bundle)

    expect(audit.ready).toBe(false)
    expect(
      audit.issues.some((issue) =>
        issue.message.includes("Missing image asset")
      )
    ).toBe(true)
  })
})
