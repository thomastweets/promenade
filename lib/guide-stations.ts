import { type Artwork, isGuidedArtwork } from "./schema"

export type GuideStation = {
  artwork: Artwork
  artworkId: string
  stationId: string
  stationNumber: number
}

function formatGuideStationId(value: number) {
  return `${value}`.padStart(2, "0")
}

export function buildGuideStations(artworks: Artwork[]): GuideStation[] {
  return artworks
    .filter(isGuidedArtwork)
    .sort((left, right) => left.number - right.number)
    .map((artwork, index) => {
      const stationNumber = index + 1

      return {
        artwork,
        artworkId: artwork.id,
        stationId: formatGuideStationId(stationNumber),
        stationNumber
      }
    })
}

export function buildGuideStationLookup(artworks: Artwork[]) {
  return new Map(
    buildGuideStations(artworks).map((station) => [station.artworkId, station])
  )
}

export function findGuideStationByArtworkId(
  artworks: Artwork[],
  artworkId: string
) {
  return buildGuideStationLookup(artworks).get(artworkId) ?? null
}

export function findGuideStationByStationId(
  artworks: Artwork[],
  stationId: string
) {
  const normalized = `${stationId}`.trim()

  return (
    buildGuideStations(artworks).find(
      (station) => station.stationId === normalized
    ) ?? null
  )
}
