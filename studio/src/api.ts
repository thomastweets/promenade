import type { Artwork, Locale, Show } from "@lib/schema"
import type {
  DashboardPayload,
  EntranceSignPayload,
  PrintLayoutMode,
  PrintSheetPayload,
  SignagePdfVariant
} from "@lib/studio"

const API_ORIGIN = __STUDIO_API_ORIGIN__

async function request<T>(input: string, init?: RequestInit) {
  const response = await fetch(`${API_ORIGIN}${input}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  })

  const data = (await response.json()) as T & { message?: string }

  if (!response.ok) {
    throw new Error(data.message || "Studio request failed.")
  }

  return data
}

export function fetchBundle() {
  return request<DashboardPayload>("/api/bundle")
}

export function saveShow(show: Show) {
  return request<DashboardPayload>("/api/show", {
    method: "PUT",
    body: JSON.stringify(show)
  })
}

export function activateShow(id: string) {
  return request<DashboardPayload>(`/api/shows/${id}/activate`, {
    method: "POST"
  })
}

export function createArtwork() {
  return request<DashboardPayload>("/api/artworks", {
    method: "POST"
  })
}

export function saveArtwork(artwork: Artwork) {
  return request<DashboardPayload>(`/api/artworks/${artwork.id}`, {
    method: "PUT",
    body: JSON.stringify(artwork)
  })
}

export function translateArtwork(id: string, locale: Locale | "all" = "all") {
  return request<DashboardPayload>(`/api/artworks/${id}/translate`, {
    method: "POST",
    body: JSON.stringify(locale === "all" ? {} : { locale })
  })
}

export function translateAllArtworks(locale: Locale | "all" = "all") {
  return request<DashboardPayload>("/api/artworks/batch/translate", {
    method: "POST",
    body: JSON.stringify(locale === "all" ? {} : { locale })
  })
}

export function generateAudioCues(id: string, locale: Locale | "all") {
  return request<DashboardPayload>(`/api/artworks/${id}/audio-cues`, {
    method: "POST",
    body: JSON.stringify({ locale })
  })
}

export function generateAllArtworkCues(locale: Locale | "all" = "all") {
  return request<DashboardPayload>("/api/artworks/batch/audio-cues", {
    method: "POST",
    body: JSON.stringify({ locale })
  })
}

export function generateAudio(
  id: string,
  locale: Locale | "all",
  options: { useCues?: boolean } = {}
) {
  return request<DashboardPayload>(`/api/artworks/${id}/audio`, {
    method: "POST",
    body: JSON.stringify({ locale, useCues: options.useCues === true })
  })
}

export function generateAllArtworkAudio(
  locale: Locale | "all" = "all",
  options: { useCues?: boolean } = {}
) {
  return request<DashboardPayload>("/api/artworks/batch/audio", {
    method: "POST",
    body: JSON.stringify({ locale, useCues: options.useCues === true })
  })
}

export async function uploadArtworkImages(id: string, files: File[]) {
  const formData = new FormData()

  for (const file of files) {
    formData.append("files", file)
  }

  const response = await fetch(`${API_ORIGIN}/api/artworks/${id}/images`, {
    method: "POST",
    body: formData
  })
  const data = (await response.json()) as DashboardPayload & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message || "Image upload failed.")
  }

  return data
}

export async function uploadShowLogo(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${API_ORIGIN}/api/show/logo`, {
    method: "POST",
    body: formData
  })
  const data = (await response.json()) as DashboardPayload & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message || "Logo upload failed.")
  }

  return data
}

export function fetchPrintSheet(
  ids: string[],
  locale: Locale,
  mode: PrintLayoutMode
) {
  const params = new URLSearchParams()

  if (ids.length) {
    params.set("ids", ids.join(","))
  }

  params.set("locale", locale)
  params.set("mode", mode)

  return request<PrintSheetPayload>(`/api/print-sheet?${params.toString()}`)
}

export function fetchEntranceSign(locale: Locale) {
  const params = new URLSearchParams()
  params.set("locale", locale)
  return request<EntranceSignPayload>(`/api/entrance-sign?${params.toString()}`)
}

export async function exportShow() {
  return request<{
    logs: string
    ready: boolean
    issues: { message: string }[]
  }>("/api/export", {
    method: "POST"
  })
}

export async function importShowBackup(file: File, targetShowId?: string) {
  const formData = new FormData()
  formData.append("backup", file)

  if (targetShowId?.trim()) {
    formData.append("targetShowId", targetShowId.trim())
  }

  const response = await fetch(`${API_ORIGIN}/api/show-backups/import`, {
    method: "POST",
    body: formData
  })
  const data = (await response.json()) as DashboardPayload & {
    importedShowId?: string
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message || "Backup import failed.")
  }

  return data
}

export function buildShowBackupUrl(id: string) {
  return `${API_ORIGIN}/api/shows/${id}/backup`
}

export function buildSignageCutSvgUrl(ids: string[]) {
  const params = new URLSearchParams()

  if (ids.length) {
    params.set("ids", ids.join(","))
  }

  return `${API_ORIGIN}/api/signage-cut.svg?${params.toString()}`
}

export function buildSignagePdfUrl(
  ids: string[],
  locale: Locale,
  options: {
    cutMarks?: boolean
    variant?: SignagePdfVariant
  } = {}
) {
  const params = new URLSearchParams()

  if (ids.length) {
    params.set("ids", ids.join(","))
  }

  params.set("locale", locale)
  if (options.cutMarks !== undefined) {
    params.set("cutMarks", options.cutMarks ? "true" : "false")
  }
  if (options.variant) {
    params.set("variant", options.variant)
  }

  return `${API_ORIGIN}/api/signage.pdf?${params.toString()}`
}

export function buildEntranceSignPdfUrl(locale: Locale) {
  const params = new URLSearchParams()
  params.set("locale", locale)
  return `${API_ORIGIN}/api/entrance-sign.pdf?${params.toString()}`
}

export function assetUrl(src: string) {
  return src.startsWith("http") ? src : `${API_ORIGIN}${src}`
}
