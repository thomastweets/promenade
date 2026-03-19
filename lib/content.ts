import fs from "node:fs"
import path from "node:path"
import { getServerEnv } from "./env.server"
import type { Artwork, Show, ShowBundle } from "./schema"
import { artworkSchema, showBundleSchema, showSchema } from "./schema"

export function getShowsDir() {
  return path.resolve(process.cwd(), getServerEnv().SHOWS_DIR)
}

export function getActiveShowId() {
  return getServerEnv().SHOW
}

export function getShowDir(showId = getActiveShowId()) {
  return path.join(getShowsDir(), showId)
}

export function getShowFilePath(showId = getActiveShowId()) {
  return path.join(getShowDir(showId), "show.json")
}

export function getArtworkDir(showId = getActiveShowId()) {
  return path.join(getShowDir(showId), "artworks")
}

export function getArtworkFilePath(showId: string, artworkId: string) {
  return path.join(getArtworkDir(showId), `${artworkId}.json`)
}

export function ensureShowDirectories(showId = getActiveShowId()) {
  fs.mkdirSync(getArtworkDir(showId), { recursive: true })
  fs.mkdirSync(path.join(getShowDir(showId), "generated"), { recursive: true })
}

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

export function loadShowSync(showId = getActiveShowId()) {
  return showSchema.parse(readJsonFile<Show>(getShowFilePath(showId)))
}

export function loadArtworksSync(showId = getActiveShowId()) {
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

export function loadShowBundleSync(showId = getActiveShowId()) {
  return showBundleSchema.parse({
    show: loadShowSync(showId),
    artworks: loadArtworksSync(showId)
  })
}

export async function loadShowBundle(showId = getActiveShowId()) {
  return loadShowBundleSync(showId)
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
  const nextNumber = artworks.length
    ? artworks[artworks.length - 1].number + 1
    : 1
  const nextId = `${nextNumber}`.padStart(2, "0")

  return artworkSchema.parse({
    id: nextId,
    number: nextNumber,
    slug: `artwork-${nextId}`,
    artist: "",
    year: "",
    title: { de: "", en: "" },
    description: { de: "", en: "" },
    material: { de: "", en: "" },
    dimensions: "",
    images: [],
    audioCues: { de: "", en: "" },
    audio: { de: "", en: "" },
    translationStatus: { de: "human", en: "missing" },
    audioCueStatus: { de: "missing", en: "missing" },
    audioStatus: { de: "missing", en: "missing" }
  })
}

export function saveShowBundleSync(showId: string, bundle: ShowBundle) {
  writeShowSync(showId, bundle.show)

  for (const artwork of bundle.artworks) {
    writeArtworkSync(showId, artwork)
  }
}
