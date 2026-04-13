import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { seedDemoShow } from "../../scripts/seed-demo-show.mjs"

const repoRoot = process.cwd()
let workspaceRoot: string | null = null

async function createWorkspace(showsDir = "shows") {
  workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "promenade-unit-backup-")
  )

  fs.cpSync(
    path.join(repoRoot, "legacy/vite-app", "fixtures"),
    path.join(workspaceRoot, "legacy", "vite-app", "fixtures"),
    { recursive: true }
  )
  fs.cpSync(
    path.join(repoRoot, "legacy/vite-app", "public", "assets"),
    path.join(workspaceRoot, "legacy", "vite-app", "public", "assets"),
    { recursive: true }
  )

  process.chdir(workspaceRoot)
  process.env.SHOW = "demo-show"
  process.env.SHOWS_DIR = showsDir
  vi.resetModules()

  await seedDemoShow({ showsDir })

  const content = await import("@lib/content")
  const backup = await import("@lib/show-backup")

  return {
    ...content,
    ...backup
  }
}

afterEach(() => {
  process.chdir(repoRoot)

  if (workspaceRoot) {
    fs.rmSync(workspaceRoot, { recursive: true, force: true })
    workspaceRoot = null
  }

  delete process.env.SHOW
  delete process.env.SHOWS_DIR
  vi.resetModules()
})

describe("show backups", () => {
  it("exports and restores a complete show side by side", async () => {
    const {
      createShowBackup,
      getActiveShowId,
      importShowBackup,
      loadShowBundleSync,
      showExists
    } = await createWorkspace()

    const { archivePath, manifest } = await createShowBackup({
      showId: "demo-show"
    })

    expect(fs.existsSync(archivePath)).toBe(true)
    expect(manifest.fileCount).toBeGreaterThan(20)

    const result = await importShowBackup({
      archivePath,
      targetShowId: "demo-show-copy"
    })

    expect(result.importedShowId).toBe("demo-show-copy")
    expect(result.audit.ready).toBe(true)
    expect(showExists("demo-show-copy")).toBe(true)
    expect(getActiveShowId()).toBe("demo-show")

    const importedBundle = loadShowBundleSync("demo-show-copy")
    const root = workspaceRoot ?? ""

    expect(importedBundle.show.id).toBe("demo-show-copy")
    expect(importedBundle.artworks[0].audio.de).toContain(
      "/shows/demo-show-copy/media/audio/"
    )
    expect(
      fs.existsSync(
        path.join(
          root,
          "public",
          "shows",
          "demo-show-copy",
          "media",
          "audio",
          "01-de.wav"
        )
      )
    ).toBe(true)
  })

  it("can activate an imported show after restore", async () => {
    const { createShowBackup, getActiveShowId, importShowBackup } =
      await createWorkspace()
    const { archivePath } = await createShowBackup({
      showId: "demo-show"
    })

    const result = await importShowBackup({
      archivePath,
      targetShowId: "demo-show-live",
      activate: true
    })

    expect(result.importedShowId).toBe("demo-show-live")
    expect(getActiveShowId()).toBe("demo-show-live")
    const root = workspaceRoot ?? ""
    expect(
      fs.readFileSync(path.join(root, "shows", ".active-show"), "utf8").trim()
    ).toBe("demo-show-live")
  })

  it("exports and restores correctly when SHOWS_DIR is overridden", async () => {
    const { createShowBackup, importShowBackup, loadShowBundleSync } =
      await createWorkspace(".playwright-shows")
    const originalBundle = loadShowBundleSync("demo-show")

    const { archivePath } = await createShowBackup({
      showId: "demo-show"
    })

    const result = await importShowBackup({
      archivePath,
      targetShowId: "demo-show-copy"
    })

    expect(result.audit.ready).toBe(true)

    const importedBundle = loadShowBundleSync("demo-show-copy")
    expect(importedBundle.show.id).toBe("demo-show-copy")
    expect(importedBundle.artworks).toHaveLength(originalBundle.artworks.length)
  })

  it("restores draft-only shows without requiring export readiness", async () => {
    const {
      createEmptyArtwork,
      createShowBackup,
      importShowBackup,
      loadShowBundleSync,
      writeArtworkSync
    } = await createWorkspace(".playwright-shows")
    const originalBundle = loadShowBundleSync("demo-show")

    writeArtworkSync("demo-show", createEmptyArtwork("demo-show"))

    const { archivePath } = await createShowBackup({
      showId: "demo-show"
    })

    const result = await importShowBackup({
      archivePath,
      targetShowId: "demo-show-draft-copy"
    })

    expect(result.importedShowId).toBe("demo-show-draft-copy")
    expect(result.audit.ready).toBe(false)
    expect(loadShowBundleSync("demo-show-draft-copy").artworks).toHaveLength(
      originalBundle.artworks.length + 1
    )
  })
})
