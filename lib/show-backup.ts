import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { z } from "zod"
import {
  ensureShowDirectories,
  getArtworkDir,
  getPublicShowDir,
  getShowDir,
  getShowFilePath,
  loadShowBundleSync,
  setActiveShowId,
  showExists,
  writeArtworkSync,
  writeShowSync
} from "./content"
import { auditShowBundle } from "./export"
import type { Artwork, ShowBundle } from "./schema"
import {
  artworkSchema,
  createLocaleRecord,
  showBundleSchema,
  supportedLocales
} from "./schema"

const backupFileSchema = z.object({
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
})

export const showBackupManifestSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  showId: z.string().min(1),
  activeShowId: z.string().min(1),
  fileCount: z.number().int().nonnegative(),
  files: z.array(backupFileSchema)
})

export type ShowBackupManifest = z.infer<typeof showBackupManifestSchema>

export type ShowImportResult = {
  importedShowId: string
  manifest: ShowBackupManifest
  audit: ReturnType<typeof auditShowBundle>
}

type BackupEntry = {
  archivePath: string
  sourcePath: string
}

function normalizeShowId(value: string) {
  const nextValue = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")

  if (!nextValue) {
    throw new Error("Show id must contain at least one letter or number.")
  }

  return nextValue
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
}

function hashFile(filePath: string) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
}

function collectFiles(rootPath: string, archiveRoot: string): BackupEntry[] {
  if (!fs.existsSync(rootPath)) {
    return []
  }

  const entries: BackupEntry[] = []

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const absolutePath = path.join(rootPath, entry.name)
    const archivePath = path.join(archiveRoot, entry.name)

    if (entry.isDirectory()) {
      entries.push(...collectFiles(absolutePath, archivePath))
      continue
    }

    entries.push({
      archivePath,
      sourcePath: absolutePath
    })
  }

  return entries.sort((left, right) =>
    left.archivePath.localeCompare(right.archivePath)
  )
}

function getBackupEntries(showId: string): BackupEntry[] {
  if (!showExists(showId)) {
    throw new Error(`Show "${showId}" does not exist.`)
  }

  return [
    {
      archivePath: path.join("shows", showId, "show.json"),
      sourcePath: getShowFilePath(showId)
    },
    ...collectFiles(
      getArtworkDir(showId),
      path.join("shows", showId, "artworks")
    ),
    ...collectFiles(
      path.join(getShowDir(showId), "generated", "qrs"),
      path.join("shows", showId, "generated", "qrs")
    ),
    ...collectFiles(
      getPublicShowDir(showId),
      path.join("public", "shows", showId)
    )
  ]
}

function copyBackupEntries(entries: BackupEntry[], targetRoot: string) {
  for (const entry of entries) {
    const targetPath = path.join(targetRoot, entry.archivePath)

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(entry.sourcePath, targetPath)
  }
}

function createManifest(entries: BackupEntry[], showId: string) {
  const activeShowId = loadShowBundleSync().show.id

  return showBackupManifestSchema.parse({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    showId,
    activeShowId,
    fileCount: entries.length,
    files: entries.map((entry) => {
      return {
        path: entry.archivePath,
        size: fs.statSync(entry.sourcePath).size,
        sha256: hashFile(entry.sourcePath)
      }
    })
  })
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd()
    })

    let stderr = ""

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr || `${command} exited with ${code}.`))
    })
    child.on("error", reject)
  })
}

function loadExtractedBundle(extractedRoot: string, showId: string) {
  const showPath = path.join(extractedRoot, "shows", showId, "show.json")
  const artworkDir = path.join(extractedRoot, "shows", showId, "artworks")

  const show = JSON.parse(fs.readFileSync(showPath, "utf8"))
  const artworks = fs
    .readdirSync(artworkDir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) =>
      artworkSchema.parse(
        JSON.parse(fs.readFileSync(path.join(artworkDir, entry), "utf8"))
      )
    )
    .sort((left, right) => left.number - right.number)

  return showBundleSchema.parse({
    show,
    artworks
  })
}

function assertManifestMatchesFiles(
  extractedRoot: string,
  manifest: ShowBackupManifest
) {
  if (manifest.fileCount !== manifest.files.length) {
    throw new Error("Backup manifest file count does not match the file list.")
  }

  for (const file of manifest.files) {
    const targetPath = path.join(extractedRoot, file.path)

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Backup is missing file ${file.path}.`)
    }

    if (fs.statSync(targetPath).size !== file.size) {
      throw new Error(`Backup file size mismatch for ${file.path}.`)
    }

    if (hashFile(targetPath) !== file.sha256) {
      throw new Error(`Backup checksum mismatch for ${file.path}.`)
    }
  }
}

function rewriteAssetPath(
  assetPath: string,
  sourceShowId: string,
  targetShowId: string
) {
  return assetPath.replace(`/shows/${sourceShowId}/`, `/shows/${targetShowId}/`)
}

function rewriteBundleShowId(
  bundle: ShowBundle,
  sourceShowId: string,
  targetShowId: string
) {
  if (sourceShowId === targetShowId) {
    return bundle
  }

  return showBundleSchema.parse({
    show: {
      ...bundle.show,
      id: targetShowId,
      branding: {
        ...bundle.show.branding,
        logoSrc: rewriteAssetPath(
          bundle.show.branding.logoSrc,
          sourceShowId,
          targetShowId
        )
      }
    },
    artworks: bundle.artworks.map((artwork) =>
      artworkSchema.parse({
        ...artwork,
        images: artwork.images.map((image) => ({
          ...image,
          src: rewriteAssetPath(image.src, sourceShowId, targetShowId)
        })),
        audio: createLocaleRecord((locale) =>
          rewriteAssetPath(artwork.audio[locale], sourceShowId, targetShowId)
        )
      })
    )
  })
}

function readBackupManifest(extractedRoot: string) {
  const manifestPath = path.join(extractedRoot, "manifest.json")

  if (!fs.existsSync(manifestPath)) {
    throw new Error("Backup archive does not contain manifest.json.")
  }

  return showBackupManifestSchema.parse(
    JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  )
}

function copyIfPresent(sourcePath: string, targetPath: string) {
  if (!fs.existsSync(sourcePath)) {
    return
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true })
}

function resolvePublicAssetPath(publicRoot: string, assetPath: string) {
  return path.join(publicRoot, assetPath.replace(/^\//, ""))
}

function assertReferencedAssetsExist(bundle: ShowBundle, publicRoot: string) {
  const assetPaths = new Set<string>()

  if (bundle.show.branding.logoSrc) {
    assetPaths.add(bundle.show.branding.logoSrc)
  }

  for (const artwork of bundle.artworks) {
    for (const image of artwork.images) {
      if (image.src) {
        assetPaths.add(image.src)
      }
    }

    for (const locale of supportedLocales) {
      if (artwork.audio[locale]) {
        assetPaths.add(artwork.audio[locale])
      }
    }
  }

  for (const assetPath of assetPaths) {
    if (!fs.existsSync(resolvePublicAssetPath(publicRoot, assetPath))) {
      throw new Error(
        `Backup archive is missing referenced asset ${assetPath}.`
      )
    }
  }
}

export async function createShowBackup({
  showId,
  outputDir = path.join(os.tmpdir(), "promenade-show-backups", showId)
}: {
  showId: string
  outputDir?: string
}) {
  const entries = getBackupEntries(showId)
  const manifest = createManifest(entries, showId)
  const stagingDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "promenade-show-backup-")
  )
  const archiveName = `${showId}-${formatTimestamp(new Date())}.tar.gz`
  const archivePath = path.join(outputDir, archiveName)

  fs.mkdirSync(outputDir, { recursive: true })

  try {
    copyBackupEntries(entries, stagingDir)
    fs.writeFileSync(
      path.join(stagingDir, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    )
    await runCommand("tar", ["-czf", archivePath, "-C", stagingDir, "."])
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }

  return {
    archivePath,
    manifest
  }
}

export async function importShowBackup({
  archivePath,
  targetShowId,
  activate = false
}: {
  archivePath: string
  targetShowId?: string
  activate?: boolean
}): Promise<ShowImportResult> {
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "promenade-import-"))

  try {
    await runCommand("tar", ["-xzf", archivePath, "-C", extractDir])

    const manifest = readBackupManifest(extractDir)
    assertManifestMatchesFiles(extractDir, manifest)

    const sourceBundle = loadExtractedBundle(extractDir, manifest.showId)
    const extractedPublicRoot = path.join(extractDir, "public")
    assertReferencedAssetsExist(sourceBundle, extractedPublicRoot)

    const nextShowId = targetShowId
      ? normalizeShowId(targetShowId)
      : manifest.showId

    if (showExists(nextShowId)) {
      throw new Error(
        `Show "${nextShowId}" already exists. Import into a new id or remove the existing show first.`
      )
    }

    const nextBundle = rewriteBundleShowId(
      sourceBundle,
      manifest.showId,
      nextShowId
    )
    const nextShowDir = getShowDir(nextShowId)
    const nextPublicShowDir = getPublicShowDir(nextShowId)

    try {
      ensureShowDirectories(nextShowId)
      writeShowSync(nextShowId, nextBundle.show)

      for (const artwork of nextBundle.artworks) {
        writeArtworkSync(nextShowId, artwork as Artwork)
      }

      fs.mkdirSync(nextPublicShowDir, { recursive: true })
      fs.cpSync(
        path.join(extractDir, "public", "shows", manifest.showId),
        nextPublicShowDir,
        {
          recursive: true
        }
      )
      copyIfPresent(
        path.join(extractDir, "shows", manifest.showId, "generated", "qrs"),
        path.join(nextShowDir, "generated", "qrs")
      )

      const audit = auditShowBundle(nextBundle)

      if (activate) {
        setActiveShowId(nextShowId)
      }

      return {
        importedShowId: nextShowId,
        manifest,
        audit
      }
    } catch (error) {
      fs.rmSync(nextShowDir, { recursive: true, force: true })
      fs.rmSync(nextPublicShowDir, { recursive: true, force: true })
      throw error
    }
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true })
  }
}
