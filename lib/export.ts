import fs from "node:fs"
import path from "node:path"
import { getAuthoritativeArtworkTitle } from "./artwork-title"
import type { Artwork, ShowBundle } from "./schema"
import {
  getShowPublicLocales,
  isApprovedState,
  isGuidedArtwork,
  type Locale
} from "./schema"

export type ExportIssue = {
  level: "error" | "warning"
  entity: "show" | "artwork"
  id: string
  message: string
}

function hasLocalizedValue(
  record: Record<Locale, string>,
  requiredLocales: readonly Locale[]
) {
  return requiredLocales.every((locale) => Boolean(record[locale]?.trim()))
}

function resolvePublicAssetPath(assetPath: string, publicRoot: string) {
  return path.join(publicRoot, assetPath.replace(/^\//, ""))
}

function collectArtworkIssues(
  artwork: Artwork,
  publicRoot: string,
  requiredLocales: readonly Locale[]
) {
  const issues: ExportIssue[] = []

  if (!artwork.artist.trim()) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "Artist name is missing."
    })
  }

  if (!getAuthoritativeArtworkTitle(artwork).trim()) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: "Authoritative artwork title is missing."
    })
  }

  if (!hasLocalizedValue(artwork.description, requiredLocales)) {
    issues.push({
      level: "error",
      entity: "artwork",
      id: artwork.id,
      message: `Descriptions are required for ${requiredLocales.join(", ")}.`
    })
  }

  for (const locale of requiredLocales) {
    if (!isApprovedState(artwork.translationStatus[locale])) {
      issues.push({
        level: "error",
        entity: "artwork",
        id: artwork.id,
        message: `${locale.toUpperCase()} translation is not approved.`
      })
    }
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
    if (!fs.existsSync(resolvePublicAssetPath(image.src, publicRoot))) {
      issues.push({
        level: "error",
        entity: "artwork",
        id: artwork.id,
        message: `Missing image asset: ${image.src}`
      })
    }
  }

  for (const locale of requiredLocales) {
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

    if (
      !fs.existsSync(resolvePublicAssetPath(artwork.audio[locale], publicRoot))
    ) {
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

export function auditShowBundle(
  bundle: ShowBundle,
  options: {
    publicRoot?: string
  } = {}
) {
  const publicRoot = options.publicRoot ?? path.resolve("public")
  const issues: ExportIssue[] = []
  const requiredLocales = getShowPublicLocales(bundle.show)

  if (!hasLocalizedValue(bundle.show.title, requiredLocales)) {
    issues.push({
      level: "error",
      entity: "show",
      id: bundle.show.id,
      message: `The show title requires ${requiredLocales.join(", ")} text.`
    })
  }

  for (const locale of requiredLocales) {
    if (!isApprovedState(bundle.show.translationStatus[locale])) {
      issues.push({
        level: "error",
        entity: "show",
        id: bundle.show.id,
        message: `The show-level ${locale.toUpperCase()} copy is not approved.`
      })
    }
  }

  if (
    !fs.existsSync(
      resolvePublicAssetPath(bundle.show.branding.logoSrc, publicRoot)
    )
  ) {
    issues.push({
      level: "error",
      entity: "show",
      id: bundle.show.id,
      message: `Missing logo asset: ${bundle.show.branding.logoSrc}`
    })
  }

  for (const artwork of bundle.artworks.filter(isGuidedArtwork)) {
    issues.push(...collectArtworkIssues(artwork, publicRoot, requiredLocales))
  }

  return {
    ready: issues.every((issue) => issue.level !== "error"),
    issues
  }
}
