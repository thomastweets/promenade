import fs from "node:fs"
import path from "node:path"
import type { Artwork, ShowBundle } from "./schema"
import { isApprovedState } from "./schema"

export type ExportIssue = {
  level: "error" | "warning"
  entity: "show" | "artwork"
  id: string
  message: string
}

function hasLocalizedValue(record: Record<"de" | "en", string>) {
  return Boolean(record.de.trim() && record.en.trim())
}

function resolvePublicAssetPath(assetPath: string) {
  return path.resolve("public", assetPath.replace(/^\//, ""))
}

function collectArtworkIssues(artwork: Artwork) {
  const issues: ExportIssue[] = []

  if (!artwork.artist.trim()) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "Artist name is missing."
    })
  }

  if (!hasLocalizedValue(artwork.title)) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "Both localized titles are required."
    })
  }

  if (!hasLocalizedValue(artwork.description)) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "Both localized descriptions are required."
    })
  }

  if (!isApprovedState(artwork.translationStatus.en)) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "English translation is not approved."
    })
  }

  if (!artwork.images.length) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "At least one artwork image is required."
    })
  }

  for (const image of artwork.images) {
    if (!fs.existsSync(resolvePublicAssetPath(image.src))) {
      issues.push({
        level: "error",
        entity: "artwork",
        id: artwork.id,
        message: `Missing image asset: ${image.src}`
      })
    }
  }

  for (const locale of ["de", "en"] as const) {
    if (!artwork.audio[locale]) {
      issues.push({
        level: "error",
        entity: "artwork",
        id: artwork.id,
        message: `Missing ${locale.toUpperCase()} audio file reference.`
      })
      continue
    }

    if (artwork.audioStatus[locale] !== "ready") {
      issues.push({
        level: "error",
        entity: "artwork",
        id: artwork.id,
        message: `${locale.toUpperCase()} audio is not ready.`
      })
    }

    if (!fs.existsSync(resolvePublicAssetPath(artwork.audio[locale]))) {
      issues.push({
        level: "error",
        entity: "artwork",
        id: artwork.id,
        message: `Missing audio asset: ${artwork.audio[locale]}`
      })
    }
  }

  return issues
}

export function auditShowBundle(bundle: ShowBundle) {
  const issues: ExportIssue[] = []

  if (!hasLocalizedValue(bundle.show.title)) {
    issues.push({
      level: "error",
      entity: "show",
      id: bundle.show.id,
      message: "The show title requires both German and English text."
    })
  }

  if (!isApprovedState(bundle.show.translationStatus.en)) {
    issues.push({
      level: "error",
      entity: "show",
      id: bundle.show.id,
      message: "The show-level English copy is not approved."
    })
  }

  if (!fs.existsSync(resolvePublicAssetPath(bundle.show.branding.logoSrc))) {
    issues.push({
      level: "error",
      entity: "show",
      id: bundle.show.id,
      message: `Missing logo asset: ${bundle.show.branding.logoSrc}`
    })
  }

  for (const artwork of bundle.artworks) {
    issues.push(...collectArtworkIssues(artwork))
  }

  return {
    ready: issues.every((issue) => issue.level !== "error"),
    issues
  }
}
