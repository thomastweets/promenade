import fs from "node:fs"
import path from "node:path"
import { getServerEnv } from "./env.server"
import type { Artwork, Show, ShowBundle } from "./schema"
import {
  artworkSchema,
  createEmptyNarrationRecordEntry,
  createLocaleRecord,
  getShowLocales,
  isGuidedArtwork,
  showBundleSchema,
  showSchema
} from "./schema"

export function getShowsDir() {
  const showsDir = path.resolve(process.cwd(), getServerEnv().SHOWS_DIR)
  fs.mkdirSync(showsDir, { recursive: true })
  return showsDir
}

export function getActiveShowFilePath() {
  const configuredPath = getServerEnv().ACTIVE_SHOW_FILE

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(getShowsDir(), configuredPath)
}

export function getPublicShowsDir() {
  const publicShowsDir = path.resolve(process.cwd(), "public", "shows")
  fs.mkdirSync(publicShowsDir, { recursive: true })
  return publicShowsDir
}

export function getActiveShowId(): string {
  const fallbackShowId = getServerEnv().SHOW
  const activeShowFile = getActiveShowFilePath()

  if (!fs.existsSync(activeShowFile)) {
    return fallbackShowId
  }

  const nextShowId = fs.readFileSync(activeShowFile, "utf8").trim()

  if (!nextShowId) {
    return fallbackShowId
  }

  return showExists(nextShowId) ? nextShowId : fallbackShowId
}

export function setActiveShowId(showId: string) {
  if (!showExists(showId)) {
    throw new Error(`Show "${showId}" does not exist.`)
  }

  fs.writeFileSync(getActiveShowFilePath(), `${showId}\n`)
}

export function getShowDir(showId: string = getActiveShowId()): string {
  return path.join(getShowsDir(), showId)
}

export function getShowFilePath(showId: string = getActiveShowId()): string {
  return path.join(getShowDir(showId), "show.json")
}

export function getArtworkDir(showId: string = getActiveShowId()): string {
  return path.join(getShowDir(showId), "artworks")
}

export function getArtworkFilePath(showId: string, artworkId: string) {
  return path.join(getArtworkDir(showId), `${artworkId}.json`)
}

export function getShowGeneratedDir(
  showId: string = getActiveShowId()
): string {
  return path.join(getShowDir(showId), "generated")
}

export function getShowBackupDir(showId: string = getActiveShowId()): string {
  return path.join(getShowGeneratedDir(showId), "backups")
}

export function getPublicShowDir(showId: string = getActiveShowId()): string {
  return path.join(getPublicShowsDir(), showId)
}

export function ensureShowDirectories(showId: string = getActiveShowId()) {
  fs.mkdirSync(getArtworkDir(showId), { recursive: true })
  fs.mkdirSync(getShowGeneratedDir(showId), { recursive: true })
  fs.mkdirSync(path.join(getShowGeneratedDir(showId), "qrs"), {
    recursive: true
  })
  fs.mkdirSync(getShowBackupDir(showId), { recursive: true })
}

export function showExists(showId: string): boolean {
  return fs.existsSync(getShowFilePath(showId))
}

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

export function loadShowSync(showId = getActiveShowId()) {
  return showSchema.parse(readJsonFile<Show>(getShowFilePath(showId)))
}

export function loadArtworksSync(showId = getActiveShowId()) {
  if (!fs.existsSync(getArtworkDir(showId))) {
    return []
  }

  return fs
    .readdirSync(getArtworkDir(showId))
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) =>
      artworkSchema.parse(
        readJsonFile<Artwork>(path.join(getArtworkDir(showId), entry))
      )
    )
    .sort((left, right) => left.number - right.number)
}

export function loadGuideArtworksSync(showId = getActiveShowId()) {
  return loadArtworksSync(showId).filter(isGuidedArtwork)
}

export function loadShowBundleSync(showId = getActiveShowId()) {
  return showBundleSchema.parse({
    show: loadShowSync(showId),
    artworks: loadArtworksSync(showId)
  })
}

export async function loadShowBundle(showId = getActiveShowId()) {
  return loadShowBundleSync(showId)
}

export type ShowSummary = {
  id: string
  title: Show["title"]
  organizationName: string
  artworkCount: number
  updatedAt: string
  active: boolean
}

export function listShowIdsSync() {
  return fs
    .readdirSync(getShowsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((showId) => showExists(showId))
    .sort()
}

export function listShowSummariesSync(): ShowSummary[] {
  const activeShowId = getActiveShowId()

  return listShowIdsSync()
    .map((showId) => {
      const show = loadShowSync(showId)
      const artworks = loadArtworksSync(showId)
      const updatedAt = fs.statSync(getShowFilePath(showId)).mtime.toISOString()

      return {
        id: showId,
        title: show.title,
        organizationName: show.organization.name,
        artworkCount: artworks.length,
        updatedAt,
        active: showId === activeShowId
      }
    })
    .sort((left, right) => Number(right.active) - Number(left.active))
}

export function writeShowSync(showId: string, show: Show) {
  ensureShowDirectories(showId)
  fs.writeFileSync(
    getShowFilePath(showId),
    JSON.stringify(showSchema.parse(show), null, 2)
  )
}

export function writeArtworkSync(showId: string, artwork: Artwork) {
  ensureShowDirectories(showId)
  fs.writeFileSync(
    getArtworkFilePath(showId, artwork.id),
    JSON.stringify(artworkSchema.parse(artwork), null, 2)
  )
}

export function createEmptyArtwork(showId = getActiveShowId()) {
  const artworks = loadArtworksSync(showId)
  const show = loadShowSync(showId)
  const nextNumber = artworks.length
    ? artworks[artworks.length - 1].number + 1
    : 1
  const nextId = `${nextNumber}`.padStart(2, "0")
  const locales = getShowLocales(show)
  const translationStatus =
    createLocaleRecord<
      Artwork["translationStatus"][keyof Artwork["translationStatus"]]
    >("missing")
  translationStatus[show.defaultLocale] = "human"

  return artworkSchema.parse({
    id: nextId,
    number: nextNumber,
    slug: `artwork-${nextId}`,
    guideMode: "guided",
    artist: "",
    year: "",
    sourceLocale: show.defaultLocale,
    titleLocale: show.defaultLocale,
    title: createLocaleRecord(""),
    titleSubtitle: createLocaleRecord(""),
    sourceDescription: createLocaleRecord(""),
    description: createLocaleRecord(""),
    material: createLocaleRecord(""),
    dimensions: "",
    images: [],
    audioCues: createLocaleRecord(""),
    audio: createLocaleRecord(""),
    narrationRecord: createLocaleRecord(() =>
      createEmptyNarrationRecordEntry()
    ),
    translationStatus,
    audioCueStatus: createLocaleRecord((locale) =>
      locales.includes(locale) ? "missing" : "missing"
    ),
    audioStatus: createLocaleRecord((locale) =>
      locales.includes(locale) ? "missing" : "missing"
    )
  })
}

export function saveShowBundleSync(showId: string, bundle: ShowBundle) {
  writeShowSync(showId, bundle.show)

  for (const artwork of bundle.artworks) {
    writeArtworkSync(showId, artwork)
  }
}
